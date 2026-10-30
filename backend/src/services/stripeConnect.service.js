'use strict';

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { getStripeClientFromSettings } = require('../config/stripe');
const { logger } = require('../config/logger');
const { resolveStripeAccountLinkUrls } = require('../utils/kycRedirectUrls');

async function loadDriverUser(providerId) {
  const user = await db.User.findByPk(providerId, {
    attributes: ['id', 'email', 'name', 'role', 'stripe_connect_account_id'],
  });
  if (!user || user.role !== 'driver') {
    throw new HttpError(404, 'Service provider not found');
  }
  return user;
}

async function getStripeOrThrow() {
  try {
    return await getStripeClientFromSettings(db);
  } catch (err) {
    logger.error('stripe_connect_client_error', { message: err?.message });
    throw new HttpError(503, 'Stripe is not configured');
  }
}

function toStripeConnectHttpError(err, fallbackMessage = 'Stripe Connect error') {
  const message = String(err?.message || fallbackMessage);

  if (/signed up for Connect/i.test(message)) {
    return new HttpError(
      503,
      'Stripe Connect is not enabled for this platform. Enable it in the Stripe Dashboard (Connect settings), then retry.',
      {
        error_type: 'stripe_connect_not_enabled',
        help_url: 'https://dashboard.stripe.com/connect',
      }
    );
  }

  // Detect test/live mode mismatch
  if (/test account.*testmode key/i.test(message) || /was a test account/i.test(message)) {
    logger.warn('stripe_connect_mode_mismatch', { stripe_error: message });
    return new HttpError(
      400,
      'Your Stripe Connect account was created in test mode. Since the platform is now in live mode, you need to verify and connect again.',
      {
        error_type: 'stripe_mode_mismatch',
        requires_reconnect: true,
        stripe_code: err?.code || null,
      }
    );
  }

  const status = err?.statusCode;
  const details = {
    error_type: err?.type || 'stripe_error',
    stripe_code: err?.code || null,
    request_id: err?.requestId || err?.request_id || null,
  };

  if (status && status >= 400 && status < 500) {
    return new HttpError(status, message, details);
  }

  return new HttpError(502, fallbackMessage, details);
}

async function runStripeConnect(op, fallbackMessage) {
  try {
    return await op();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.error('stripe_connect_api_error', { message: err?.message, code: err?.code });
    throw toStripeConnectHttpError(err, fallbackMessage);
  }
}

async function getOrCreateConnectAccount(user) {
  if (user.stripe_connect_account_id) {
    return user.stripe_connect_account_id;
  }

  const stripe = await getStripeOrThrow();
  const account = await runStripeConnect(
    () =>
      stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email || undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          user_id: String(user.id),
          role: String(user.role),
        },
      }),
    'Failed to create Stripe Connect account for driver'
  );

  await user.update({ stripe_connect_account_id: account.id });
  return account.id;
}

function mapConnectAccountStatus(account) {
  const requirements = account.requirements || {};
  const currentlyDue = Array.isArray(requirements.currently_due) ? requirements.currently_due : [];
  const pastDue = Array.isArray(requirements.past_due) ? requirements.past_due : [];
  const kycComplete = Boolean(account.details_submitted && account.payouts_enabled);

  return {
    account_id: account.id,
    details_submitted: Boolean(account.details_submitted),
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    kyc_complete: kycComplete,
    requirements_due: [...new Set([...currentlyDue, ...pastDue])],
    disabled_reason: requirements.disabled_reason || null,
  };
}

function baseDisconnectedStatus() {
  return {
    account_id: null,
    is_connected: false,
    details_submitted: false,
    charges_enabled: false,
    payouts_enabled: false,
    kyc_complete: false,
    requirements_due: [],
    disabled_reason: null,
    kyc_url: null,
    kyc_url_expires_at: null,
  };
}

async function getConnectAccountStatus(providerId) {
  const user = await loadDriverUser(providerId);

  if (!user.stripe_connect_account_id) {
    return baseDisconnectedStatus();
  }

  const stripe = await getStripeOrThrow();
  try {
    const account = await runStripeConnect(
      () => stripe.accounts.retrieve(user.stripe_connect_account_id),
      'Failed to load Stripe Connect account'
    );
    const status = mapConnectAccountStatus(account);

    return {
      ...status,
      is_connected: true,
      kyc_url: null,
      kyc_url_expires_at: null,
    };
  } catch (err) {
    // Detect test/live mode mismatch: "test account created with testmode key"
    const message = String(err?.message || '');
    if (/test account.*testmode/i.test(message) || /mode mismatch/i.test(message)) {
      logger.warn('stripe_connect_mode_mismatch', {
        user_id: user.id,
        account_id: user.stripe_connect_account_id,
        error: message,
      });
      // Return disconnected status so frontend shows "complete verification" CTA
      return { ...baseDisconnectedStatus(), error_type: 'stripe_mode_mismatch' };
    }
    throw err;
  }
}

/**
 * Stripe Connect status plus onboarding URL when not connected or KYC incomplete.
 */
async function getConnectStatusWithKycLink(providerId) {
  await loadDriverUser(providerId);

  let status = await getConnectAccountStatus(providerId);

  if (!status.kyc_complete) {
    const link = await createOnboardingLink(providerId);
    status = {
      ...status,
      account_id: link.account_id,
      is_connected: Boolean(link.account_id),
      kyc_complete: link.kyc_complete,
      kyc_url: link.kyc_url,
      kyc_url_expires_at: link.expires_at,
    };
  }

  return status;
}

async function assertKycComplete(providerId) {
  const status = await getConnectAccountStatus(providerId);
  if (!status.kyc_complete) {
    throw new HttpError(403, 'Stripe identity verification (KYC) is required before requesting a payout', {
      error_type: 'kyc_required',
    });
  }
  return status;
}

async function createOnboardingLink(providerId) {
  const user = await loadDriverUser(providerId);
  const accountId = await getOrCreateConnectAccount(user);
  const stripe = await getStripeOrThrow();

  const { returnUrl, refreshUrl } = resolveStripeAccountLinkUrls();

  const status = await getConnectAccountStatus(providerId);
  const linkType = status.kyc_complete ? 'account_update' : 'account_onboarding';

  const accountLink = await runStripeConnect(
    () =>
      stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: linkType,
      }),
    'Failed to create Stripe KYC onboarding link'
  );

  return {
    account_id: accountId,
    kyc_url: accountLink.url,
    expires_at: accountLink.expires_at ? new Date(accountLink.expires_at * 1000).toISOString() : null,
    kyc_complete: status.kyc_complete,
  };
}

/**
 * Reconnect: clears the old (mismatched) Connect account and creates a new one in the
 * current Stripe mode. This is the fix for "test account used with live keys" errors.
 */
async function reconnectConnectAccount(providerId) {
  const user = await loadDriverUser(providerId);

  // Save old account ID for logging
  const oldAccountId = user.stripe_connect_account_id;
  if (oldAccountId) {
    logger.info('stripe_connect_reconnect_clearing_old_account', {
      user_id: user.id,
      old_account_id: oldAccountId,
    });
  }

  // Clear the stale account reference
  await user.update({ stripe_connect_account_id: null });

  // Create a fresh Connect account in the current (live) mode
  const accountId = await getOrCreateConnectAccount(user);

  // Generate onboarding link for KYC
  const link = await createOnboardingLink(providerId);

  return {
    ...link,
    reconnected: true,
    old_account_id: oldAccountId,
  };
}

module.exports = {
  getOrCreateConnectAccount,
  getConnectAccountStatus,
  getConnectStatusWithKycLink,
  assertKycComplete,
  createOnboardingLink,
  reconnectConnectAccount,
};
