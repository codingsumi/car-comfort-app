'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const {
  TX_ACCEPT_CREDIT,
  TX_SERVICE_START_ADVANCE,
  TX_COMPLETE_RELEASE,
  TX_COMPLETE_BALANCE,
  TX_CANCEL_REVERSAL,
  TX_TIP_CREDIT,
  TX_CANCELLATION_PROVIDER_SHARE,
  ledgerMetaForTransactionType,
} = require('../utils/walletLedger');
const { getPlatformBalanceAmounts } = require('./stripeBalance.service');
const { notifyDriverEarningsReleased } = require('./driverNotify.service');
const { resolveBookingProviderCompensationAmount } = require('../utils/providerCompensation');
const {
  SERVICE_START_ADVANCE_AMOUNT,
  computeProviderCancellationShareAmount,
} = require('../constants/providerPayout.constants');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Total provider compensation for a booking (admin package config). */
function computeProviderServiceAmount(booking) {
  return roundTwo(Math.max(0, resolveBookingProviderCompensationAmount(booking)));
}

function computeServiceStartAdvanceAmount(booking) {
  const total = computeProviderServiceAmount(booking);
  return roundTwo(Math.min(SERVICE_START_ADVANCE_AMOUNT, total));
}

async function isBookingPaid(bookingId, transaction) {
  const txn = await db.BookingTransaction.findOne({
    where: { booking_id: bookingId, status: 'succeeded' },
    transaction,
  });
  return !!txn;
}

async function getOrCreateWallet(providerId, transaction) {
  let wallet = await db.ProviderWallet.findOne({
    where: { provider_id: providerId },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!wallet) {
    wallet = await db.ProviderWallet.create(
      {
        provider_id: providerId,
        pending_balance: 0,
        available_for_payout: 0,
        currency: 'usd',
      },
      { transaction }
    );
  }

  return wallet;
}

function formatWalletResponse(wallet, providerId, { stripeBalance = null } = {}) {
  const internalPending = roundTwo(wallet.pending_balance);
  const internalAvailable = roundTwo(wallet.available_for_payout);
  let availableForPayout = internalAvailable;
  let pendingStripeSettlement = 0;

  if (stripeBalance && Number.isFinite(Number(stripeBalance.available))) {
    const stripeAvailable = roundTwo(Math.max(0, stripeBalance.available));
    availableForPayout = roundTwo(Math.min(internalAvailable, stripeAvailable));
    pendingStripeSettlement = roundTwo(Math.max(0, internalAvailable - availableForPayout));
  }

  const walletAmount = roundTwo(internalPending + pendingStripeSettlement);
  return {
    provider_id: providerId,
    wallet_amount: walletAmount,
    available_for_payout: availableForPayout,
    total_balance: roundTwo(internalPending + internalAvailable),
    currency: wallet.currency || 'usd',
    pending_stripe_settlement: pendingStripeSettlement,
    internal_available_for_payout: internalAvailable,
    stripe_balance: stripeBalance,
  };
}

async function findAcceptCredit(bookingId, transaction) {
  return db.ProviderWalletTransaction.findOne({
    where: { booking_id: bookingId, transaction_type: TX_ACCEPT_CREDIT },
    transaction,
  });
}

async function findServiceStartAdvance(bookingId, providerId, transaction) {
  const pid = Number(providerId || 0);
  const where = {
    booking_id: bookingId,
    transaction_type: TX_SERVICE_START_ADVANCE,
  };
  if (pid > 0) where.provider_id = pid;

  return db.ProviderWalletTransaction.findOne({
    where,
    transaction,
  });
}

async function sumPendingCreditsForBooking(bookingId, transaction, providerId = null) {
  const where = {
    booking_id: bookingId,
    transaction_type: { [Op.in]: [TX_ACCEPT_CREDIT, TX_SERVICE_START_ADVANCE, TX_COMPLETE_BALANCE] },
    status: { [Op.ne]: 'failed' },
  };
  const pid = Number(providerId || 0);
  if (pid > 0) where.provider_id = pid;

  const rows = await db.ProviderWalletTransaction.findAll({
    where,
    transaction,
  });
  return roundTwo(rows.reduce((sum, row) => sum + toAmount(row.amount), 0));
}

/**
 * @deprecated Billing spec: advance is credited on service start, not accept.
 */
async function creditWalletOnBookingAccept({ providerId, booking, transaction }) {
  return { credited: false, amount: 0, reason: 'advance_on_service_start' };
}

/**
 * Credit $50 (or full compensation if lower) when driver starts service.
 */
async function creditWalletOnServiceStart({ providerId, booking, transaction }) {
  const amount = computeServiceStartAdvanceAmount(booking);
  if (amount <= 0) {
    return { credited: false, amount: 0, reason: 'zero_amount' };
  }

  const existing = await findServiceStartAdvance(booking.id, providerId, transaction);
  if (existing) {
    const wallet = await getOrCreateWallet(providerId, transaction);
    return {
      credited: false,
      amount: roundTwo(existing.amount),
      wallet: formatWalletResponse(wallet, providerId),
      reason: 'already_credited',
    };
  }

  const wallet = await getOrCreateWallet(providerId, transaction);
  const newPending = roundTwo(toAmount(wallet.pending_balance) + amount);

  await wallet.update({ pending_balance: newPending }, { transaction });

  const bookingLabel = booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;

  await db.ProviderWalletTransaction.create(
    {
      provider_id: providerId,
      booking_id: booking.id,
      transaction_type: TX_SERVICE_START_ADVANCE,
      ...ledgerMetaForTransactionType(TX_SERVICE_START_ADVANCE),
      amount,
      balance_after: newPending,
      currency: wallet.currency || 'usd',
      description: `Service start advance for booking ${bookingLabel}`,
    },
    { transaction }
  );

  const updatedWallet = await getOrCreateWallet(providerId, transaction);
  return {
    credited: true,
    amount,
    wallet: formatWalletResponse(updatedWallet, providerId),
  };
}

/**
 * Move full provider compensation from pending to available when service is completed and paid.
 * The ledger row is created with status `completed`, but [reconcileProviderCreditTransactionStatuses]
 * may mark it `pending` until Stripe settlement makes the balance withdrawable.
 */
async function releaseWalletOnBookingComplete({ booking, transaction }) {
  const providerId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  if (!providerId) return { released: false, reason: 'no_provider' };

  if (String(booking.status) !== 'completed') {
    return { released: false, reason: 'not_completed' };
  }

  const paid = await isBookingPaid(booking.id, transaction);
  if (!paid) return { released: false, reason: 'not_paid' };

  const existingRelease = await db.ProviderWalletTransaction.findOne({
    where: {
      booking_id: booking.id,
      transaction_type: TX_COMPLETE_RELEASE,
      provider_id: providerId,
    },
    transaction,
  });
  if (existingRelease) {
    const wallet = await getOrCreateWallet(providerId, transaction);
    return { released: false, wallet: formatWalletResponse(wallet, providerId), reason: 'already_released' };
  }

  const totalComp = computeProviderServiceAmount(booking);
  if (totalComp <= 0) return { released: false, reason: 'zero_amount' };

  let wallet = await getOrCreateWallet(providerId, transaction);
  let pendingCredits = await sumPendingCreditsForBooking(booking.id, transaction, providerId);
  const topUp = roundTwo(Math.max(0, totalComp - pendingCredits));
  const bookingLabel = booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;

  if (topUp > 0) {
    const newPending = roundTwo(toAmount(wallet.pending_balance) + topUp);
    await wallet.update({ pending_balance: newPending }, { transaction });
    await db.ProviderWalletTransaction.create(
      {
        provider_id: providerId,
        booking_id: booking.id,
        transaction_type: TX_COMPLETE_BALANCE,
        ...ledgerMetaForTransactionType(TX_COMPLETE_BALANCE),
        amount: topUp,
        balance_after: newPending,
        currency: wallet.currency || 'usd',
        description: `Remaining compensation for completed booking ${bookingLabel}`,
      },
      { transaction }
    );
    pendingCredits = roundTwo(pendingCredits + topUp);
    wallet = await getOrCreateWallet(providerId, transaction);
  }

  const releaseAmount = totalComp;
  const pending = toAmount(wallet.pending_balance);
  const payout = toAmount(wallet.available_for_payout);
  const deductFromPending = roundTwo(Math.min(pending, releaseAmount));
  const newPending = roundTwo(pending - deductFromPending);
  const newPayout = roundTwo(payout + releaseAmount);

  await wallet.update(
    { pending_balance: newPending, available_for_payout: newPayout },
    { transaction }
  );

  await db.ProviderWalletTransaction.create(
    {
      provider_id: providerId,
      booking_id: booking.id,
      transaction_type: TX_COMPLETE_RELEASE,
      ...ledgerMetaForTransactionType(TX_COMPLETE_RELEASE),
      amount: releaseAmount,
      balance_after: newPayout,
      currency: wallet.currency || 'usd',
      description: `Released to payout for completed booking ${bookingLabel}`,
    },
    { transaction }
  );

  await db.ProviderWalletTransaction.update(
    { status: 'completed' },
    {
      where: {
        booking_id: booking.id,
        provider_id: providerId,
        transaction_type: {
          [Op.in]: [TX_ACCEPT_CREDIT, TX_SERVICE_START_ADVANCE, TX_COMPLETE_BALANCE],
        },
      },
      transaction,
    }
  );

  const updatedWallet = await getOrCreateWallet(providerId, transaction);
  const result = { released: true, amount: releaseAmount, wallet: formatWalletResponse(updatedWallet, providerId) };

  if (!transaction) {
    void reconcileProviderCreditTransactionStatuses(providerId).catch((err) => {
      logger.warn('reconcile_credit_status_after_release_failed', {
        bookingId: booking.id,
        providerId,
        message: err?.message,
      });
    });
    void notifyDriverEarningsReleased({
      providerId,
      booking,
      amount: releaseAmount,
      wallet: result.wallet,
    }).catch((err) => {
      logger.warn('driver_earnings_released_notify_failed', {
        bookingId: booking.id,
        providerId,
        message: err?.message,
      });
    });
  }

  return result;
}

/**
 * Reverse pending wallet credits when a booking is cancelled before completion.
 */
async function reverseWalletOnBookingCancel({ booking, transaction }) {
  const providerId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  if (!providerId) return { reversed: false, reason: 'no_provider' };

  const pendingAmount = await sumPendingCreditsForBooking(booking.id, transaction, providerId);
  if (pendingAmount <= 0) return { reversed: false, reason: 'no_pending_credit' };

  const existingReversal = await db.ProviderWalletTransaction.findOne({
    where: {
      booking_id: booking.id,
      transaction_type: TX_CANCEL_REVERSAL,
      provider_id: providerId,
    },
    transaction,
  });
  if (existingReversal) {
    const wallet = await getOrCreateWallet(providerId, transaction);
    return { reversed: false, wallet: formatWalletResponse(wallet, providerId), reason: 'already_reversed' };
  }

  const existingRelease = await db.ProviderWalletTransaction.findOne({
    where: {
      booking_id: booking.id,
      transaction_type: TX_COMPLETE_RELEASE,
      provider_id: providerId,
    },
    transaction,
  });

  const wallet = await getOrCreateWallet(providerId, transaction);
  let newPending = toAmount(wallet.pending_balance);
  let newPayout = toAmount(wallet.available_for_payout);

  if (existingRelease) {
    newPayout = roundTwo(Math.max(0, newPayout - pendingAmount));
  } else {
    newPending = roundTwo(Math.max(0, newPending - pendingAmount));
  }

  await wallet.update({ pending_balance: newPending, available_for_payout: newPayout }, { transaction });

  const bookingLabel = booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;

  await db.ProviderWalletTransaction.create(
    {
      provider_id: providerId,
      booking_id: booking.id,
      transaction_type: TX_CANCEL_REVERSAL,
      ...ledgerMetaForTransactionType(TX_CANCEL_REVERSAL),
      amount: pendingAmount,
      balance_after: existingRelease ? newPayout : newPending,
      currency: wallet.currency || 'usd',
      description: `Reversed for cancelled booking ${bookingLabel}`,
    },
    { transaction }
  );

  await db.ProviderWalletTransaction.update(
    { status: 'failed' },
    {
      where: {
        booking_id: booking.id,
        provider_id: providerId,
        transaction_type: {
          [Op.in]: [
            TX_ACCEPT_CREDIT,
            TX_SERVICE_START_ADVANCE,
            TX_COMPLETE_BALANCE,
            TX_COMPLETE_RELEASE,
          ],
        },
      },
      transaction,
    }
  );

  const updatedWallet = await getOrCreateWallet(providerId, transaction);
  return { reversed: true, amount: pendingAmount, wallet: formatWalletResponse(updatedWallet, providerId) };
}

/**
 * En-route / no-show cancellation: $20 to provider, $5 retained by platform (of $25 fee).
 */
async function creditProviderEnRouteCancellationShare({
  booking,
  cancellationFee,
  feeReason = null,
  transaction,
}) {
  const providerId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  if (!providerId) return { credited: false, reason: 'no_provider' };

  const fee = toAmount(cancellationFee);
  if (fee <= 0) return { credited: false, reason: 'no_fee' };

  const providerShare = computeProviderCancellationShareAmount(fee);
  if (providerShare <= 0) return { credited: false, reason: 'zero_share' };

  const existingShare = await db.ProviderWalletTransaction.findOne({
    where: {
      booking_id: booking.id,
      transaction_type: TX_CANCELLATION_PROVIDER_SHARE,
      provider_id: providerId,
    },
    transaction,
  });
  if (existingShare) {
    return {
      credited: false,
      amount: roundTwo(existingShare.amount),
      reason: 'already_credited',
    };
  }

  const wallet = await getOrCreateWallet(providerId, transaction);
  const newPayout = roundTwo(toAmount(wallet.available_for_payout) + providerShare);
  await wallet.update({ available_for_payout: newPayout }, { transaction });

  const bookingLabel = booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;
  const feeReasonKey = String(feeReason || '').trim().toLowerCase();
  const description =
    feeReasonKey === 'customer_no_show'
      ? `Customer no-show share for booking ${bookingLabel}`
      : `Cancellation fee share for booking ${bookingLabel}`;

  await db.ProviderWalletTransaction.create(
    {
      provider_id: providerId,
      booking_id: booking.id,
      transaction_type: TX_CANCELLATION_PROVIDER_SHARE,
      ledger_type: 'credit',
      status: 'completed',
      amount: providerShare,
      balance_after: newPayout,
      currency: wallet.currency || 'usd',
      description,
    },
    { transaction }
  );

  return { credited: true, amount: providerShare };
}

/**
 * Idempotent: move pending provider earnings to available_for_payout when booking is completed + paid.
 */
async function tryReleaseWalletForCompletedBooking(bookingId, transaction = null) {
  const id = Number(bookingId);
  if (!id) return { released: false, reason: 'invalid_id' };

  const booking = await db.Booking.findByPk(id, { transaction });
  if (!booking) return { released: false, reason: 'not_found' };

  if (String(booking.status) !== 'completed') {
    return { released: false, reason: 'not_completed' };
  }

  return releaseWalletOnBookingComplete({ booking, transaction });
}

async function handleBookingStatusWalletTransition({ booking, previousStatus, transaction }) {
  const nextStatus = String(booking.status);
  const providerId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  if (!providerId) return null;

  if (nextStatus === 'completed' && previousStatus !== 'completed') {
    return releaseWalletOnBookingComplete({ booking, transaction });
  }

  if (nextStatus === 'cancelled' && previousStatus !== 'cancelled') {
    return reverseWalletOnBookingCancel({ booking, transaction });
  }

  return null;
}

async function getProviderWalletSummary(providerId) {
  const wallet = await getOrCreateWallet(providerId, null);
  return formatWalletResponse(wallet, providerId);
}

/** Wallet totals for API/notifications — matches driver wallet screen (Stripe-capped withdrawable). */
async function getProviderWalletDisplay(providerId) {
  const id = Number(providerId);
  if (!id) {
    throw new HttpError(400, 'Invalid provider id');
  }

  const wallet = await getOrCreateWallet(id, null);
  let stripeBalance = null;
  try {
    stripeBalance = await getPlatformBalanceAmounts({ currency: wallet.currency || 'usd' });
  } catch (err) {
    logger.warn('driver_wallet_stripe_balance_unavailable', {
      providerId: id,
      message: err?.message,
    });
  }

  return formatWalletResponse(wallet, id, { stripeBalance });
}

async function getProviderWalletForAuth(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();

  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');

  const wallet = await getOrCreateWallet(userId, null);
  let stripeBalance = null;
  try {
    stripeBalance = await getPlatformBalanceAmounts({ currency: wallet.currency || 'usd' });
  } catch (err) {
    logger.warn('driver_wallet_stripe_balance_unavailable', {
      providerId: userId,
      message: err?.message,
    });
  }

  try {
    await reconcileProviderCreditTransactionStatuses(userId);
  } catch (err) {
    logger.warn('driver_wallet_reconcile_credit_status_failed', {
      providerId: userId,
      message: err?.message,
    });
  }

  return formatWalletResponse(wallet, userId, { stripeBalance });
}

async function findTipCredit(bookingId, transaction) {
  return db.ProviderWalletTransaction.findOne({
    where: { booking_id: bookingId, transaction_type: TX_TIP_CREDIT },
    transaction,
  });
}

/**
 * Credit provider available_for_payout when a customer tip payment succeeds.
 */
async function creditProviderTipOnBooking({ tip, transaction: outerTxn }) {
  const providerId = Number(tip.provider_user_id);
  const bookingId = Number(tip.booking_id);
  const amount = roundTwo(tip.amount);

  if (!providerId || amount <= 0) {
    return { credited: false, reason: 'invalid_tip' };
  }

  const run = async (transaction) => {
    const existing = await findTipCredit(bookingId, transaction);
    if (existing) {
      const wallet = await getOrCreateWallet(providerId, transaction);
      return { credited: false, reason: 'already_credited', wallet: formatWalletResponse(wallet, providerId) };
    }

    const wallet = await getOrCreateWallet(providerId, transaction);
    const newPayout = roundTwo(toAmount(wallet.available_for_payout) + amount);

    await wallet.update({ available_for_payout: newPayout }, { transaction });

    const booking = await db.Booking.findByPk(bookingId, {
      attributes: ['id', 'booking_code'],
      transaction,
    });
    const bookingLabel = booking?.booking_code ? String(booking.booking_code) : `#${bookingId}`;

    await db.ProviderWalletTransaction.create(
      {
        provider_id: providerId,
        booking_id: bookingId,
        transaction_type: TX_TIP_CREDIT,
        ...ledgerMetaForTransactionType(TX_TIP_CREDIT),
        amount,
        balance_after: newPayout,
        currency: wallet.currency || 'usd',
        description: `Customer tip for booking ${bookingLabel}`,
      },
      { transaction }
    );

    const updatedWallet = await getOrCreateWallet(providerId, transaction);
    return { credited: true, amount, wallet: formatWalletResponse(updatedWallet, providerId) };
  };

  if (outerTxn) return run(outerTxn);

  const t = await db.sequelize.transaction();
  try {
    const result = await run(t);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function notifyDriverTipIfCredited({ tip, creditResult }) {
  if (!creditResult?.credited) return;
  const { notifyDriverCustomerTip } = require('./driverNotify.service');
  const bookingId = Number(tip.booking_id);
  const booking = await db.Booking.findByPk(bookingId, {
    attributes: ['id', 'booking_code', 'assigned_driver_user_id'],
  });
  void notifyDriverCustomerTip({ tip, booking }).catch((err) => {
    logger.warn('notify_driver_customer_tip_failed', {
      bookingId,
      providerId: tip.provider_user_id,
      tipId: tip.id,
      message: err?.message,
    });
  });
}

/** Credits shown in payment history whose withdrawability follows Stripe settlement. */
const WITHDRAWABLE_CREDIT_TRANSACTION_TYPES = [
  TX_COMPLETE_RELEASE,
  TX_TIP_CREDIT,
  TX_CANCELLATION_PROVIDER_SHARE,
];

async function resolvePendingStripeSettlementAmount(wallet) {
  const internalAvailable = roundTwo(toAmount(wallet.available_for_payout));
  if (internalAvailable <= 0) return 0;
  try {
    const stripeBalance = await getPlatformBalanceAmounts({
      currency: wallet.currency || 'usd',
    });
    const stripeAvailable = roundTwo(Math.max(0, stripeBalance?.available ?? 0));
    return roundTwo(Math.max(0, internalAvailable - stripeAvailable));
  } catch (err) {
    logger.debug('resolve_pending_stripe_settlement_unavailable', {
      providerId: wallet.provider_id,
      message: err?.message,
    });
    return 0;
  }
}

/**
 * Keep payment-history credit statuses aligned with wallet withdrawability.
 * Ledger entries for completed services are recorded immediately, but funds can
 * still be blocked by Stripe settlement — those credits should appear as
 * "pending" in history until they match available_for_payout on the wallet.
 */
async function reconcileProviderCreditTransactionStatuses(providerId) {
  const id = Number(providerId);
  if (!id) return { updated: 0 };

  const wallet = await getOrCreateWallet(id, null);
  const pendingStripe = await resolvePendingStripeSettlementAmount(wallet);

  const credits = await db.ProviderWalletTransaction.findAll({
    where: {
      provider_id: id,
      transaction_type: { [Op.in]: WITHDRAWABLE_CREDIT_TRANSACTION_TYPES },
      ledger_type: 'credit',
      status: { [Op.ne]: 'failed' },
    },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });

  let remaining = pendingStripe;
  let updated = 0;
  for (const row of credits) {
    const amt = roundTwo(toAmount(row.amount));
    const nextStatus = remaining > 0 && amt > 0 ? 'pending' : 'completed';
    if (row.status !== nextStatus) {
      await row.update({ status: nextStatus });
      updated += 1;
    }
    if (remaining > 0 && amt > 0) {
      remaining = roundTwo(remaining - amt);
    }
  }

  return { updated };
}

async function finalizeTipFromPaymentIntent(paymentIntent) {
  const piId = paymentIntent?.id;
  if (!piId) return { handled: false, reason: 'no_pi_id' };

  const kind = String(paymentIntent?.metadata?.payment_kind || '');
  if (kind !== 'provider_tip') return { handled: false, reason: 'not_tip' };

  const tipId = Number(paymentIntent?.metadata?.booking_tip_id || 0);
  let tip = tipId
    ? await db.BookingTip.findByPk(tipId)
    : await db.BookingTip.findOne({ where: { stripe_payment_intent_id: piId } });

  if (!tip) return { handled: false, reason: 'tip_not_found' };

  if (tip.status === 'succeeded') {
    return { handled: true, action: 'tip_already_finalized', booking_id: tip.booking_id };
  }

  const t = await db.sequelize.transaction();
  try {
    if (tip.booking_transaction_id) {
      const txn = await db.BookingTransaction.findByPk(tip.booking_transaction_id, { transaction: t });
      if (txn && txn.status !== 'succeeded') {
        await txn.update(
          { status: 'succeeded', stripe_payload: paymentIntent, stripe_payment_intent_id: piId },
          { transaction: t }
        );
      }
    }

    await tip.update(
      { status: 'succeeded', stripe_payment_intent_id: piId },
      { transaction: t }
    );

    const creditResult = await creditProviderTipOnBooking({ tip, transaction: t });
    await t.commit();
    await tip.reload();
    await notifyDriverTipIfCredited({ tip, creditResult });
  } catch (err) {
    await t.rollback();
    throw err;
  }

  return { handled: true, action: 'tip_succeeded', booking_id: tip.booking_id, tip_id: tip.id };
}

async function failTipFromPaymentIntent(paymentIntent) {
  const kind = String(paymentIntent?.metadata?.payment_kind || '');
  if (kind !== 'provider_tip') return { handled: false, reason: 'not_tip' };

  const piId = paymentIntent?.id;
  const tip = await db.BookingTip.findOne({
    where: piId ? { stripe_payment_intent_id: piId } : { id: Number(paymentIntent?.metadata?.booking_tip_id || 0) },
  });
  if (!tip || tip.status === 'succeeded') return { handled: false, reason: 'tip_not_found_or_done' };

  if (tip.booking_transaction_id) {
    const txn = await db.BookingTransaction.findByPk(tip.booking_transaction_id);
    if (txn && txn.status !== 'failed') {
      await txn.update({
        status: 'failed',
        stripe_error: paymentIntent.last_payment_error || { message: paymentIntent.status },
        stripe_payload: paymentIntent,
      });
    }
  }

  if (tip.status !== 'failed') {
    await tip.update({ status: 'failed', stripe_payment_intent_id: piId || tip.stripe_payment_intent_id });
  }

  return { handled: true, action: 'tip_failed', booking_id: tip.booking_id };
}

module.exports = {
  computeProviderServiceAmount,
  creditWalletOnBookingAccept,
  creditWalletOnServiceStart,
  creditProviderEnRouteCancellationShare,
  releaseWalletOnBookingComplete,
  tryReleaseWalletForCompletedBooking,
  reverseWalletOnBookingCancel,
  handleBookingStatusWalletTransition,
  getProviderWalletSummary,
  getProviderWalletDisplay,
  getProviderWalletForAuth,
  getOrCreateWallet,
  creditProviderTipOnBooking,
  finalizeTipFromPaymentIntent,
  failTipFromPaymentIntent,
  reconcileProviderCreditTransactionStatuses,
};
