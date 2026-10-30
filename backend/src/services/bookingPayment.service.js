const { Op } = require('sequelize');
const db = require('../models');
const { getStripe, getStripeForUser } = require('../config/stripe');
const { HttpError } = require('../utils/httpError');
const { ensureStripeCustomer, toStripeHttpError } = require('./stripe.service');
const { generateTransactionCode } = require('../repositories/transactionCode.repository');
const { logger } = require('../config/logger');

const OPEN_CHECKOUT_STATUSES = ['failed', 'processing', 'requires_action', 'requires_payment_method'];
const MAX_IDEMPOTENCY_RETRIES = 3;

function toMinorUnits(amountDecimal) {
  const n = Number(amountDecimal);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Invalid amount');
  return Math.round(n * 100);
}

function roundAmount(amount) {
  return Number(Number(amount).toFixed(2));
}

/**
 * Stripe idempotency keys must be unique per payment attempt.
 * Use the DB primary key (never reused) — not transaction_code, which can
 * collide with Stripe's 24h idempotency cache if a prior attempt used the same code.
 */
function stripeIdempotencyKeyForTxn(txn) {
  const id = txn?.id;
  if (!id) throw new HttpError(500, 'Missing transaction reference for payment');
  return `booking_pi_${id}`;
}

function amountsMatch(a, b) {
  return roundAmount(a) === roundAmount(b);
}

function isStripeIdempotencyError(err) {
  const message = String(err?.message || '');
  return (
    err?.type === 'StripeIdempotencyError' ||
    err?.code === 'idempotency_key_in_use' ||
    /idempotent/i.test(message) ||
    /same parameters/i.test(message)
  );
}

async function getUserOrThrow(userId) {
  const user = await db.User.findByPk(userId);
  if (!user) throw new HttpError(401, 'Unauthorized');
  return user;
}

async function findSucceededTransaction({ bookingId, userId }) {
  return db.BookingTransaction.findOne({
    where: { booking_id: bookingId, user_id: userId, status: 'succeeded' },
    order: [['id', 'DESC']],
  });
}

async function cancelStripePaymentIntentIfOpen(stripe, piId) {
  if (!piId) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (!['succeeded', 'canceled'].includes(pi.status)) {
      await stripe.paymentIntents.cancel(piId);
    }
  } catch (err) {
    logger.warn('booking_payment_pi_cancel_skipped', {
      paymentIntentId: piId,
      message: err?.message,
    });
  }
}

/**
 * Mark open checkout rows cancelled and cancel their Stripe payment intents.
 */
async function cancelAbandonedCheckoutAttempts({ bookingId, userId, stripe }) {
  const rows = await db.BookingTransaction.findAll({
    where: {
      booking_id: bookingId,
      user_id: userId,
      status: { [Op.in]: OPEN_CHECKOUT_STATUSES },
    },
    order: [['id', 'DESC']],
  });

  await Promise.all(
    rows.map(async (txn) => {
      if (stripe && txn.stripe_payment_intent_id) {
        await cancelStripePaymentIntentIfOpen(stripe, txn.stripe_payment_intent_id);
      }
    })
  );

  if (!rows.length) return;

  await db.BookingTransaction.update(
    { status: 'cancelled' },
    {
      where: {
        id: { [Op.in]: rows.map((row) => row.id) },
      },
    }
  );
}

async function tryReuseExistingPaymentIntent({
  stripe,
  txn,
  chargeAmount,
  payment_method_id,
}) {
  const piId = txn?.stripe_payment_intent_id;
  if (!piId) return null;

  let pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status === 'succeeded') return pi;
  if (pi.status === 'canceled') return null;
  if (pi.amount !== toMinorUnits(chargeAmount)) return null;

  const storedPm = String(txn?.payment_method_id || '').trim();
  const nextPm = String(payment_method_id || '').trim();
  if (nextPm && storedPm && storedPm !== nextPm) {
    return null;
  }

  if (payment_method_id && pi.payment_method !== payment_method_id) {
    pi = await stripe.paymentIntents.update(piId, { payment_method: payment_method_id });
  }

  if (pi.status === 'requires_confirmation') {
    pi = await stripe.paymentIntents.confirm(piId, { payment_method: payment_method_id });
  }

  return pi;
}

async function createCheckoutTransaction({ booking, userId, chargeAmount, payment_method_id, currency }) {
  const { transaction_code } = await generateTransactionCode({ now: new Date() });
  return db.BookingTransaction.create({
    transaction_code,
    booking_id: booking.id,
    user_id: userId,
    currency,
    amount: chargeAmount,
    status: 'processing',
    payment_method_id,
  });
}

async function createAndConfirmPaymentIntent({
  booking,
  userId,
  payment_method_id,
  amount,
  currency = 'usd',
  _idempotencyAttempt = 0,
}) {
  const user = await getUserOrThrow(userId);
  const stripe = await getStripeForUser(userId);
  const customerId = await ensureStripeCustomer(user);
  const chargeAmount = roundAmount(amount);

  const succeeded = await findSucceededTransaction({ bookingId: booking.id, userId });
  if (succeeded) {
    return succeeded.get({ plain: true });
  }

  const latestWithPi = await db.BookingTransaction.findOne({
    where: {
      booking_id: booking.id,
      user_id: userId,
      stripe_payment_intent_id: { [Op.ne]: null },
      status: { [Op.in]: OPEN_CHECKOUT_STATUSES },
    },
    order: [['id', 'DESC']],
  });

  if (latestWithPi && amountsMatch(latestWithPi.amount, chargeAmount)) {
    try {
      const existingPi = await tryReuseExistingPaymentIntent({
        stripe,
        txn: latestWithPi,
        chargeAmount,
        payment_method_id,
      });
      if (existingPi) {
        await latestWithPi.update({
          status: existingPi.status || 'processing',
          payment_method_id,
          stripe_payment_intent_id: existingPi.id,
          stripe_payload: existingPi,
          stripe_error: null,
        });
        const { syncBookingPayment } = require('./transactionSync.service');
        syncBookingPayment({ bookingTransaction: latestWithPi, booking }).catch(() => {});
        return latestWithPi.get({ plain: true });
      }
    } catch (err) {
      logger.warn('booking_payment_pi_reuse_failed', {
        bookingId: booking.id,
        transactionId: latestWithPi.id,
        message: err?.message,
      });
    }
  }

  await cancelAbandonedCheckoutAttempts({ bookingId: booking.id, userId, stripe });

  const txn = await createCheckoutTransaction({
    booking,
    userId,
    chargeAmount,
    payment_method_id,
    currency,
  });

  const idempotencyKey = stripeIdempotencyKeyForTxn(txn);

  let pi;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: toMinorUnits(chargeAmount),
        currency,
        customer: customerId,
        payment_method: payment_method_id,
        confirm: true,
        off_session: true,
        description: booking.booking_code ? `Booking ${booking.booking_code}` : `Booking ${booking.id}`,
        metadata: {
          booking_id: String(booking.id),
          booking_code: booking.booking_code ? String(booking.booking_code) : '',
          transaction_code: txn.transaction_code,
          booking_transaction_id: String(txn.id),
        },
      },
      { idempotencyKey }
    );
  } catch (err) {
    await txn.update({
      status: 'failed',
      stripe_error: {
        message: err?.message,
        type: err?.type,
        code: err?.code,
        decline_code: err?.decline_code,
        param: err?.param,
        statusCode: err?.statusCode,
      },
    });

    if (isStripeIdempotencyError(err) && _idempotencyAttempt < MAX_IDEMPOTENCY_RETRIES) {
      await txn.update({ status: 'cancelled' });
      return createAndConfirmPaymentIntent({
        booking,
        userId,
        payment_method_id,
        amount,
        currency,
        _idempotencyAttempt: _idempotencyAttempt + 1,
      });
    }

    throw toStripeHttpError(err, 'Payment failed');
  }

  await txn.update({
    status: pi?.status || 'processing',
    stripe_payment_intent_id: pi?.id || null,
    stripe_payload: pi || null,
  });

  const { syncBookingPayment } = require('./transactionSync.service');
  syncBookingPayment({ bookingTransaction: txn, booking }).catch(() => {});

  return txn.get({ plain: true });
}

/**
 * Serialize checkout payment for a booking so parallel confirm requests cannot
 * race on Stripe idempotency keys. Lock is held only for the brief DB read —
 * not during the external Stripe call.
 */
async function createAndConfirmPaymentIntentForBooking(params) {
  const { booking, userId } = params;
  await db.sequelize.transaction(async (t) => {
    const locked = await db.Booking.findOne({
      where: { id: booking.id, user_id: userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!locked) throw new HttpError(404, 'Booking not found');
  });
  return createAndConfirmPaymentIntent(params);
}

module.exports = {
  createAndConfirmPaymentIntent: createAndConfirmPaymentIntentForBooking,
};
