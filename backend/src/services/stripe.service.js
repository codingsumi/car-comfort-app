const { getStripe } = require('../config/stripe');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');

function isStripeNotFoundError(err) {
  return err?.code === 'resource_missing' || err?.statusCode === 404;
}

function toStripeHttpError(err, fallbackMessage = 'Stripe error') {
  const status = err?.statusCode;
  const safeDetails = {
    type: err?.type,
    code: err?.code,
    decline_code: err?.decline_code,
    param: err?.param,
    requestId: err?.requestId || err?.request_id,
    statusCode: status
  };

  if (err?.code === 'resource_missing' && err?.param === 'payment_method') {
    logger.error('stripe_key_mismatch', {
      error_type: 'stripe_key_mismatch',
      stripe_code: err?.code,
      stripe_type: err?.type,
      stripe_status: err?.statusCode,
      stripe_request_id: err?.requestId || err?.request_id,
      hint: 'App sent a payment_method created with a different key than the server secret key',
    });
    return new HttpError(
      400,
      'This card could not be verified. The app and server must use matching Stripe keys from the same account and mode (test or live). Update Admin Settings → Payments → Stripe, then try again.',
      { stripe: safeDetails, error_type: 'stripe_key_mismatch' }
    );
  }

  // Stripe errors are usually client errors (4xx) or Stripe outages (5xx).
  // We normalize to 502 for most Stripe failures to keep API consistent.
  if (status && status >= 400 && status < 500) {
    return new HttpError(400, err?.message || fallbackMessage, { stripe: safeDetails });
  }
  return new HttpError(502, fallbackMessage, { stripe: safeDetails });
}

async function createCustomerForUser(user) {
  const stripe = await getStripe();

  const name =
    typeof user?.name === 'string' && user.name.trim()
      ? user.name.trim()
      : [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || undefined;

  const customer = await stripe.customers.create({
    email: user.email,
    name,
    metadata: {
      user_id: String(user.id)
    }
  });

  return customer;
}

/**
 * Ensures a valid Stripe customer exists for the given DB user.
 * - If `user.stripe_customer_id` exists: retrieves it; if deleted/missing -> creates new.
 * - If missing: creates and persists.
 * Returns the stripe_customer_id.
 */
async function ensureStripeCustomer(user) {
  if (!user?.id) throw new HttpError(500, 'Invalid user context');

  const stripe = await getStripe();

  // Use mode-specific customer ID so test/live customers never collide.
  const { getStripeConfig } = require('./settingsRuntime.service');
  const config = await getStripeConfig(require('../models'));
  const mode = config.paymentMode || 'test';
  const modeField = mode === 'live' ? 'stripe_customer_id_live' : 'stripe_customer_id_test';

  // Read from mode-specific field first, fall back to legacy field (for existing test customers).
  const existingId = (user[modeField] ? String(user[modeField]) : '') ||
    (mode === 'test' && user.stripe_customer_id ? String(user.stripe_customer_id) : '');

  logger.info('stripe_ensure_customer', {
    user_id: user.id,
    mode,
    mode_field: modeField,
    existing_id_preview: existingId ? existingId.substring(0, 16) + '...' : 'none',
  });
  if (existingId) {
    try {
      const customer = await stripe.customers.retrieve(existingId);
      if (customer?.deleted) {
        const created = await createCustomerForUser(user);
        await user.update({ [modeField]: created.id, stripe_customer_id: created.id });
        return created.id;
      }
      return customer.id;
    } catch (err) {
      if (!isStripeNotFoundError(err)) {
        logger.error('Stripe customer retrieve failed', {
          message: err?.message,
          code: err?.code,
          statusCode: err?.statusCode
        });
        throw toStripeHttpError(err, 'Failed to retrieve Stripe customer');
      }

      // Customer not found in this mode — create a new one for this mode.
      try {
        const created = await createCustomerForUser(user);
        await user.update({ [modeField]: created.id, stripe_customer_id: created.id });
        return created.id;
      } catch (createErr) {
        logger.error('Stripe customer create-after-missing failed', {
          message: createErr?.message,
          code: createErr?.code,
          statusCode: createErr?.statusCode
        });
        throw toStripeHttpError(createErr, 'Failed to create Stripe customer');
      }
    }
  }

  try {
    const created = await createCustomerForUser(user);
    await user.update({ [modeField]: created.id, stripe_customer_id: created.id });
    return created.id;
  } catch (err) {
    logger.error('Stripe customer create failed', { message: err?.message, code: err?.code, statusCode: err?.statusCode });
    throw toStripeHttpError(err, 'Failed to create Stripe customer');
  }
}

/** Customer checkout methods (bank / ACH excluded). */
const CUSTOMER_PAYMENT_METHOD_TYPES = Object.freeze(['card', 'paypal', 'link']);

const STRIPE_API_VERSION = '2026-03-25.dahlia';

function resolveSetupIntentPaymentMethodTypes(category) {
  const key = String(category || 'card').trim().toLowerCase();
  switch (key) {
    case 'credit':
    case 'debit':
    case 'card':
      return ['card'];
    case 'paypal':
      return ['paypal'];
    case 'venmo':
      return ['paypal'];
    case 'apple_pay':
    case 'google_pay':
    case 'wallet':
      return ['card', 'link'];
    default:
      return ['card', 'paypal', 'link'];
  }
}

function formatPaymentMethodForApi(pm, defaultId) {
  const type = String(pm?.type || '').trim();
  const isDefault = Boolean(defaultId && pm?.id === defaultId);

  if (type === 'card') {
    const walletType = pm.card?.wallet?.type || null;
    return {
      id: pm.id,
      type: 'card',
      brand: pm.card?.brand || null,
      last4: pm.card?.last4 || null,
      exp_month: pm.card?.exp_month || null,
      exp_year: pm.card?.exp_year || null,
      wallet_type: walletType,
      is_default: isDefault,
    };
  }

  if (type === 'paypal') {
    return {
      id: pm.id,
      type: 'paypal',
      brand: 'paypal',
      display_name: pm.paypal?.payer_email || 'PayPal',
      is_default: isDefault,
    };
  }

  if (type === 'link') {
    return {
      id: pm.id,
      type: 'link',
      brand: 'link',
      display_name: pm.link?.email || 'Link',
      is_default: isDefault,
    };
  }

  return {
    id: pm.id,
    type: type || 'unknown',
    brand: type || 'unknown',
    is_default: isDefault,
  };
}

async function customerHasPaymentMethod(stripe, customerId, paymentMethodId) {
  for (const type of CUSTOMER_PAYMENT_METHOD_TYPES) {
    // eslint-disable-next-line no-await-in-loop
    const list = await stripe.paymentMethods.list({ customer: customerId, type });
    if (list?.data?.some((pm) => pm.id === paymentMethodId)) return true;
  }
  return false;
}

async function addCardAndSetDefault({ user, payment_method_id }) {
  const stripe = await getStripe();

  // ── Diagnostic: log exactly which key the server is using ──
  try {
    const { getStripeConfig } = require('../services/settingsRuntime.service');
    const { db } = require('../models');
    const config = await getStripeConfig(require('../models'));
    const sk = config.secretKey || '';
    const pk = config.publishableKey || '';
    logger.info('add_card_key_diagnostic', {
      payment_method_id,
      user_id: user?.id,
      mode: config.paymentMode,
      sk_prefix: sk.substring(0, 14),
      sk_suffix: sk.slice(-6),
      sk_type: sk.includes('sk_live_') ? 'LIVE' : sk.includes('sk_test_') ? 'TEST' : 'UNKNOWN',
      pk_prefix: pk.substring(0, 14),
      pk_type: pk.includes('pk_live_') ? 'LIVE' : pk.includes('pk_test_') ? 'TEST' : 'UNKNOWN',
      pm_prefix: (payment_method_id || '').substring(0, 6),
    });
  } catch (diagErr) {
    logger.warn('add_card_key_diagnostic_failed', { error: diagErr?.message });
  }

  const customerId = await ensureStripeCustomer(user);

  // Prevent duplicate attach (and allow idempotent retries).
  let alreadyAttached = false;
  try {
    alreadyAttached = await customerHasPaymentMethod(stripe, customerId, payment_method_id);
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to list payment methods');
  }

  if (!alreadyAttached) {
    try {
      await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    } catch (err) {
      // If the payment method is already attached (possibly by a race), proceed to default update.
      if (err?.code !== 'payment_method_unexpected_state') {
        throw toStripeHttpError(err, 'Failed to attach payment method');
      }
    }
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id }
    });
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to set default payment method');
  }

  await user.update({ default_payment_method_id: payment_method_id });
  return { customerId, default_payment_method_id: payment_method_id };
}

async function listCards({ user }) {
  const stripe = await getStripe();
  const customerId = await ensureStripeCustomer(user);

  let customer;
  try {
    customer = await stripe.customers.retrieve(customerId);
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to retrieve Stripe customer');
  }

  const defaultId =
    (customer?.invoice_settings && customer.invoice_settings.default_payment_method) ||
    null;

  const paymentMethods = [];
  try {
    for (const type of CUSTOMER_PAYMENT_METHOD_TYPES) {
      // eslint-disable-next-line no-await-in-loop
      const list = await stripe.paymentMethods.list({ customer: customerId, type });
      for (const pm of list?.data || []) {
        paymentMethods.push(formatPaymentMethodForApi(pm, defaultId));
      }
    }
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to list payment methods');
  }

  const cards = paymentMethods
    .filter((pm) => pm.type === 'card')
    .map((pm) => ({
      id: pm.id,
      brand: pm.brand,
      last4: pm.last4,
      exp_month: pm.exp_month,
      exp_year: pm.exp_year,
      wallet_type: pm.wallet_type,
      is_default: pm.is_default,
    }));

  return {
    customerId,
    default_payment_method_id: defaultId,
    cards,
    payment_methods: paymentMethods,
  };
}

async function createCustomerSetupIntent({ user, category }) {
  const stripe = await getStripe();
  const customerId = await ensureStripeCustomer(user);
  const payment_method_types = resolveSetupIntentPaymentMethodTypes(category);

  let setupIntent;
  try {
    setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types,
      usage: 'off_session',
    });
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to create setup intent');
  }

  let ephemeralKey;
  try {
    ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: STRIPE_API_VERSION }
    );
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to create ephemeral key');
  }

  return {
    customer_id: customerId,
    setup_intent_client_secret: setupIntent.client_secret,
    ephemeral_key_secret: ephemeralKey.secret,
    payment_method_types,
    category: String(category || 'card').trim().toLowerCase() || 'card',
  };
}

async function setDefaultCard({ user, payment_method_id }) {
  const stripe = await getStripe();
  const customerId = await ensureStripeCustomer(user);

  let belongs = false;
  try {
    belongs = await customerHasPaymentMethod(stripe, customerId, payment_method_id);
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to list payment methods');
  }
  if (!belongs) throw new HttpError(400, 'Payment method is not attached to this customer');

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id }
    });
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to set default payment method');
  }

  await user.update({ default_payment_method_id: payment_method_id });
  return { customerId, default_payment_method_id: payment_method_id };
}

async function removeCard({ user, payment_method_id }) {
  const stripe = await getStripe();
  const customerId = await ensureStripeCustomer(user);

  let stripeDefaultId = null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    stripeDefaultId =
      (customer?.invoice_settings && customer.invoice_settings.default_payment_method) ||
      null;
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to retrieve Stripe customer');
  }

  try {
    const belongs = await customerHasPaymentMethod(stripe, customerId, payment_method_id);
    if (!belongs) throw new HttpError(400, 'Payment method is not attached to this customer');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw toStripeHttpError(err, 'Failed to validate payment method ownership');
  }

  try {
    await stripe.paymentMethods.detach(payment_method_id);
  } catch (err) {
    throw toStripeHttpError(err, 'Failed to detach payment method');
  }

  const removedWasDefault = Boolean(
    stripeDefaultId && String(stripeDefaultId) === String(payment_method_id)
  );

  // If they removed the default card, promote another attached card as default (most recent).
  if (removedWasDefault) {
    let nextDefaultId = null;
    try {
      for (const type of CUSTOMER_PAYMENT_METHOD_TYPES) {
        // eslint-disable-next-line no-await-in-loop
        const remaining = await stripe.paymentMethods.list({ customer: customerId, type });
        const candidate = remaining?.data?.[0]?.id;
        if (candidate) {
          nextDefaultId = candidate;
          break;
        }
      }
    } catch (err) {
      throw toStripeHttpError(err, 'Failed to list remaining payment methods');
    }

    if (nextDefaultId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: nextDefaultId }
        });
      } catch (err) {
        throw toStripeHttpError(err, 'Failed to set replacement default payment method');
      }

      await user.update({ default_payment_method_id: nextDefaultId });
      return { customerId, removed: true, default_payment_method_id: nextDefaultId };
    }

    await user.update({ default_payment_method_id: null });
    return { customerId, removed: true, default_payment_method_id: null };
  }

  // The Stripe Customer is mode-specific; never fall back to the legacy
  // user-level default because it could belong to the other Stripe mode.
  return { customerId, removed: true, default_payment_method_id: stripeDefaultId || null };
}

module.exports = {
  ensureStripeCustomer,
  addCardAndSetDefault,
  listCards,
  createCustomerSetupIntent,
  setDefaultCard,
  removeCard,
  toStripeHttpError,
  CUSTOMER_PAYMENT_METHOD_TYPES,
};
