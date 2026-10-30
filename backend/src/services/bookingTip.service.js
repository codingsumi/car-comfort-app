'use strict';

const db = require('../models');
const { getStripe } = require('../config/stripe');
const { HttpError } = require('../utils/httpError');
const { ensureStripeCustomer, listCards, toStripeHttpError } = require('./stripe.service');
const { generateTransactionCode } = require('../repositories/transactionCode.repository');
const { finalizeTipFromPaymentIntent } = require('./providerWallet.service');

const MIN_TIP = 1;
const MAX_TIP = 500;

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toMinorUnits(amountDecimal) {
  const n = Number(amountDecimal);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Invalid amount');
  return Math.round(n * 100);
}

function normalizeTipAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, 'amount is required');
  const amount = roundTwo(n);
  if (amount < MIN_TIP) throw new HttpError(400, `Tip must be at least $${MIN_TIP}`);
  if (amount > MAX_TIP) throw new HttpError(400, `Tip cannot exceed $${MAX_TIP}`);
  return amount;
}

function getCustomerAuthOrThrow(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId || role !== 'customer') throw new HttpError(403, 'Only customers can tip providers');
  return userId;
}

function formatTipResponse(tip) {
  const plain = tip?.get ? tip.get({ plain: true }) : tip;
  if (!plain) return null;
  return {
    id: plain.id,
    booking_id: plain.booking_id,
    amount: roundTwo(plain.amount),
    currency: plain.currency || 'usd',
    status: plain.status,
    stripe_payment_intent_id: plain.stripe_payment_intent_id,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

async function resolvePaymentMethodId({ user, payment_method_id }) {
  if (payment_method_id) return String(payment_method_id).trim();
  const { default_payment_method_id } = await listCards({ user });
  if (!default_payment_method_id) {
    throw new HttpError(400, 'No payment method on file. Add a card before tipping.');
  }
  return String(default_payment_method_id);
}

async function getBookingForCustomerTip(bookingId, customerId) {
  const booking = await db.Booking.findOne({
    where: { id: bookingId, user_id: customerId },
    attributes: ['id', 'booking_code', 'status', 'user_id', 'assigned_driver_user_id'],
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status !== 'completed') {
    throw new HttpError(400, 'Tips are allowed only after the booking is completed');
  }
  if (!booking.assigned_driver_user_id) {
    throw new HttpError(400, 'No provider assigned to this booking');
  }
  return booking;
}

async function createBookingTip({ bookingId, auth, body }) {
  const customerId = getCustomerAuthOrThrow(auth);
  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'bookingId must be a positive integer');

  const amount = normalizeTipAmount(body?.amount);
  const booking = await getBookingForCustomerTip(id, customerId);
  const providerId = Number(booking.assigned_driver_user_id);

  const existing = await db.BookingTip.findOne({ where: { booking_id: booking.id } });
  if (existing && existing.status === 'succeeded') {
    throw new HttpError(409, 'A tip has already been sent for this booking');
  }
  if (existing && existing.status === 'processing') {
    throw new HttpError(409, 'Tip payment is already processing');
  }

  const user = await db.User.findByPk(customerId);
  if (!user) throw new HttpError(401, 'Unauthorized');

  const payment_method_id = await resolvePaymentMethodId({
    user,
    payment_method_id: body?.payment_method_id,
  });

  const stripe = await getStripe();
  const customerIdStripe = await ensureStripeCustomer(user);
  const { transaction_code } = await generateTransactionCode({ now: new Date() });

  const t = await db.sequelize.transaction();
  let tip;
  let txn;
  try {
    if (existing) {
      await existing.update({ status: 'cancelled' }, { transaction: t });
    }

    tip = await db.BookingTip.create(
      {
        booking_id: booking.id,
        customer_user_id: customerId,
        provider_user_id: providerId,
        amount,
        currency: 'usd',
        status: 'processing',
      },
      { transaction: t }
    );

    txn = await db.BookingTransaction.create(
      {
        transaction_code,
        booking_id: booking.id,
        user_id: customerId,
        currency: 'usd',
        amount,
        status: 'processing',
        payment_method_id,
      },
      { transaction: t }
    );

    await tip.update({ booking_transaction_id: txn.id }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const bookingLabel = booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;
  let pi;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: toMinorUnits(amount),
        currency: 'usd',
        customer: customerIdStripe,
        payment_method: payment_method_id,
        confirm: true,
        off_session: true,
        description: `Tip for booking ${bookingLabel}`,
        metadata: {
          payment_kind: 'provider_tip',
          booking_id: String(booking.id),
          booking_tip_id: String(tip.id),
          transaction_code,
        },
      },
      { idempotencyKey: `tip-${transaction_code}` }
    );
  } catch (err) {
    await tip.update({ status: 'failed' });
    await txn.update({
      status: 'failed',
      stripe_error: {
        message: err?.message,
        type: err?.type,
        code: err?.code,
        decline_code: err?.decline_code,
      },
    });
    throw toStripeHttpError(err, 'Tip payment failed');
  }

  await txn.update({
    status: pi?.status === 'succeeded' ? 'succeeded' : 'processing',
    stripe_payment_intent_id: pi?.id || null,
    stripe_payload: pi || null,
  });
  await tip.update({ stripe_payment_intent_id: pi?.id || null });

  if (pi?.status === 'succeeded') {
    await finalizeTipFromPaymentIntent(pi);
    await tip.reload();
  }

  return formatTipResponse(tip);
}

async function getBookingTip({ bookingId, auth }) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');

  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'bookingId must be a positive integer');

  const booking = await db.Booking.findByPk(id, {
    attributes: ['id', 'user_id', 'assigned_driver_user_id'],
  });
  if (!booking) throw new HttpError(404, 'Booking not found');

  const isCustomer = role === 'customer' && Number(booking.user_id) === userId;
  const isDriver =
    role === 'driver' && Number(booking.assigned_driver_user_id) === userId;
  if (!isCustomer && !isDriver && role !== 'admin') {
    throw new HttpError(403, 'Forbidden');
  }

  const tip = await db.BookingTip.findOne({ where: { booking_id: id } });
  return { tip: formatTipResponse(tip) };
}

function canCustomerTipOnBooking({ status, assignedDriverUserId, tip }) {
  if (String(status) !== 'completed') return false;
  if (!assignedDriverUserId) return false;
  if (tip && String(tip.status) === 'succeeded') return false;
  if (tip && String(tip.status) === 'processing') return false;
  return true;
}

module.exports = {
  createBookingTip,
  getBookingTip,
  formatTipResponse,
  canCustomerTipOnBooking,
  MIN_TIP,
  MAX_TIP,
};
