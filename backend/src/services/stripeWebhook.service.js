'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { getStripeClientFromSettings } = require('../config/stripe');
const {
  tryReleaseWalletForCompletedBooking,
  finalizeTipFromPaymentIntent,
  failTipFromPaymentIntent,
} = require('./providerWallet.service');
const { syncBookingPayment } = require('./transactionSync.service');
const {
  STRIPE_WEBHOOK_EVENT_TYPES,
  handleTransferEvent,
  handleConnectPayoutEvent,
  handleRefundEvent,
  handleChargeRefunded,
  handleCapabilityUpdated,
  handleBalanceAvailable,
} = require('./stripePayoutWebhook.service');

async function resolveWebhookSecret() {
  const { getStripeConfig } = require('./settingsRuntime.service');
  const config = await getStripeConfig(db);
  const secret = String(config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not configured. ' +
      'Set it in your environment or admin settings to enable webhook signature verification.'
    );
  }
  return secret;
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const piId = paymentIntent?.id;
  if (!piId) return { handled: false, reason: 'no_pi_id' };

  if (String(paymentIntent?.metadata?.payment_kind || '') === 'provider_tip') {
    return finalizeTipFromPaymentIntent(paymentIntent);
  }

  const txn = await db.BookingTransaction.findOne({
    where: { stripe_payment_intent_id: piId },
  });

  if (!txn) {
    const bookingId = Number(paymentIntent?.metadata?.booking_id || 0);
    if (!bookingId) {
      logger.info('stripe_webhook_pi_no_local_txn', { paymentIntentId: piId });
      return { handled: false, reason: 'txn_not_found' };
    }
    const booking = await db.Booking.findByPk(bookingId);
    if (!booking) return { handled: false, reason: 'booking_not_found' };
    if (String(booking.status) === 'completed') {
      const release = await tryReleaseWalletForCompletedBooking(bookingId);
      return { handled: true, action: 'wallet_release_only', release };
    }
    return { handled: false, reason: 'txn_not_found' };
  }

  const prevStatus = txn.status;
  if (prevStatus !== 'succeeded') {
    await txn.update({
      status: 'succeeded',
      stripe_payload: paymentIntent,
    });
  }

  const booking = await db.Booking.findByPk(txn.booking_id);
  if (booking) {
    syncBookingPayment({ bookingTransaction: txn, booking }).catch((err) => {
      logger.warn('stripe_webhook_sync_finance_failed', { bookingId: booking.id, message: err?.message });
    });
  }

  let release = { released: false, reason: 'booking_not_completed' };
  if (booking && String(booking.status) === 'completed') {
    release = await tryReleaseWalletForCompletedBooking(booking.id);
  }

  return {
    handled: true,
    action: 'payment_intent_succeeded',
    booking_id: txn.booking_id,
    txn_updated: prevStatus !== 'succeeded',
    wallet_release: release,
  };
}

async function handlePaymentIntentFailed(paymentIntent) {
  const piId = paymentIntent?.id;
  if (!piId) return { handled: false };

  if (String(paymentIntent?.metadata?.payment_kind || '') === 'provider_tip') {
    return failTipFromPaymentIntent(paymentIntent);
  }

  const txn = await db.BookingTransaction.findOne({
    where: { stripe_payment_intent_id: piId },
  });
  if (!txn) return { handled: false, reason: 'txn_not_found' };

  if (txn.status !== 'failed') {
    await txn.update({
      status: 'failed',
      stripe_error: paymentIntent.last_payment_error || { message: paymentIntent.status },
      stripe_payload: paymentIntent,
    });
  }

  return { handled: true, action: 'payment_intent_failed', booking_id: txn.booking_id };
}

async function handlePaymentIntentCanceled(paymentIntent) {
  const piId = paymentIntent?.id;
  if (!piId) return { handled: false };

  if (String(paymentIntent?.metadata?.payment_kind || '') === 'provider_tip') {
    return failTipFromPaymentIntent(paymentIntent);
  }

  const txn = await db.BookingTransaction.findOne({
    where: { stripe_payment_intent_id: piId },
  });
  if (!txn) return { handled: false, reason: 'txn_not_found' };

  if (txn.status !== 'cancelled') {
    await txn.update({
      status: 'cancelled',
      stripe_payload: paymentIntent,
    });
  }

  return { handled: true, action: 'payment_intent_canceled', booking_id: txn.booking_id };
}

async function handleAccountUpdated(account) {
  const accountId = account?.id;
  if (!accountId) return { handled: false };

  const user = await db.User.findOne({
    where: { stripe_connect_account_id: accountId },
    attributes: ['id'],
  });

  logger.info('stripe_webhook_account_updated', {
    accountId,
    userId: user?.id || null,
    details_submitted: Boolean(account.details_submitted),
    payouts_enabled: Boolean(account.payouts_enabled),
  });

  return { handled: true, action: 'account_updated', user_id: user?.id || null };
}

async function dispatchStripeEvent(event) {
  const type = event?.type;
  const obj = event?.data?.object;

  switch (type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(obj);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(obj);
    case 'payment_intent.canceled':
      return handlePaymentIntentCanceled(obj);
    case 'charge.refunded':
      return handleChargeRefunded(obj);
    case 'charge.refund.updated':
      return handleRefundEvent(obj, type);
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      return handleRefundEvent(obj, type);
    case 'transfer.created':
    case 'transfer.updated':
    case 'transfer.reversed':
      return handleTransferEvent(obj, type);
    case 'payout.paid':
    case 'payout.failed':
    case 'payout.canceled':
    case 'payout.updated':
      return handleConnectPayoutEvent(obj, type);
    case 'account.updated':
      return handleAccountUpdated(obj);
    case 'capability.updated':
      return handleCapabilityUpdated(obj);
    case 'balance.available':
      return handleBalanceAvailable(obj);
    default:
      return { handled: false, reason: 'ignored', type };
  }
}

async function constructEventFromRequest(req) {
  const secret = await resolveWebhookSecret();
  if (!secret) {
    const err = new Error('Stripe webhook secret is not configured');
    err.status = 503;
    throw err;
  }

  const stripe = await getStripeClientFromSettings(db);
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    const err = new Error('Missing Stripe-Signature header');
    err.status = 400;
    throw err;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
    const err = new Error('Webhook requires raw request body');
    err.status = 400;
    throw err;
  }

  return stripe.webhooks.constructEvent(rawBody, signature, secret,1800);
}

async function processStripeWebhookRequest(req) {
  const event = await constructEventFromRequest(req);
  const result = await dispatchStripeEvent(event);
  logger.info('stripe_webhook_processed', { type: event.type, id: event.id, result });
  return { event_id: event.id, type: event.type, result };
}

module.exports = {
  processStripeWebhookRequest,
  dispatchStripeEvent,
  STRIPE_WEBHOOK_EVENT_TYPES,
};
