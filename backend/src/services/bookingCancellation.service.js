const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { getStripe } = require('../config/stripe');
const { logger } = require('../config/logger');
const {
  handleBookingStatusWalletTransition,
  creditProviderEnRouteCancellationShare,
} = require('./providerWallet.service');
const { notifyBookingCancelled } = require('../modules/bookings/bookingCancellationNotify.service');

const {
  getCustomerCancellationFeeAmount,
  getCustomerNoShowFeeAmount,
} = require('./bookingCharges.service');
const { resolveTrackingStatusRank } = require('../modules/bookings/trackingStatuses');
const { SCHEDULED_CANCEL_FEE_WINDOW_MINUTES } = require('../constants/bookingNotification.constants');
const {
  isProviderWaitingAtPickup,
  isProviderWithinMinutesOfPickup,
} = require('../utils/bookingEnRoutePolicy');

const OTP_VERIFIED_TRACKING_RANK = resolveTrackingStatusRank('OTP_VERIFIED');

/** Provider may cancel while en route to the service stop (before service begins). */
const DRIVER_SERVICE_CANCEL_TRACKING_STATUSES = new Set([
  'DRIVER_STARTED_TO_SERVICE_CENTER',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
]);

function assertCancellationAllowedForHandover(booking, cancelledBy) {
  const by = String(cancelledBy || '').toLowerCase();
  if (by === 'admin') return;

  const tracking = String(booking.tracking_status || '').trim().toUpperCase();
  if (by === 'driver' && DRIVER_SERVICE_CANCEL_TRACKING_STATUSES.has(tracking)) {
    return;
  }

  const rank = resolveTrackingStatusRank(tracking);
  if (rank >= 0 && rank >= OTP_VERIFIED_TRACKING_RANK) {
    throw new HttpError(
      409,
      'Bookings cannot be cancelled after vehicle handover OTP verification. Contact support if you need assistance.'
    );
  }
}

const CANCELLABLE_STATUSES = new Set([
  'pending_payment',
  'confirmed',
  'assigned',
  'in_progress',
]);

function toMinorUnits(amountDecimal) {
  const n = Number(amountDecimal);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Invalid amount');
  return Math.round(n * 100);
}

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function sumRefundAmountsForBooking(bookingId, transaction = null) {
  const rows = await db.RefundRequest.findAll({
    where: {
      booking_id: bookingId,
      status: ['processing', 'refunded', 'approved'],
    },
    transaction,
  });
  return roundTwo(rows.reduce((sum, row) => sum + toAmount(row.amount), 0));
}

/**
 * Split remaining capture into refund vs newly retained no-show fee.
 * Avoids charging the customer twice when multiple providers report no-show.
 */
function computeNoShowRefundAndFee({
  paidAmount,
  noShowFee,
  alreadyRefunded,
  priorCancellationFee,
}) {
  const paid = roundTwo(toAmount(paidAmount));
  const feeCap = roundTwo(toAmount(noShowFee));
  const refunded = roundTwo(toAmount(alreadyRefunded));
  const priorFee = roundTwo(toAmount(priorCancellationFee));

  const remainingCaptured = roundTwo(Math.max(0, paid - refunded));
  const refundAmount = roundTwo(Math.max(0, remainingCaptured - feeCap));
  let newlyRetainedFee = roundTwo(Math.min(feeCap, remainingCaptured - refundAmount));

  if (
    refundAmount === 0 &&
    priorFee > 0 &&
    remainingCaptured > 0 &&
    remainingCaptured <= feeCap
  ) {
    newlyRetainedFee = 0;
  }

  return {
    refundAmount,
    newlyRetainedFee,
    remainingCaptured,
    totalCancellationFee: roundTwo(priorFee + newlyRetainedFee),
    totalRefunded: roundTwo(refunded + refundAmount),
  };
}

async function computePolicy({ booking, cancelledBy, now = new Date() }) {
  let cancellationFeeAmount = 25;
  let noShowFeeAmount = 25;
  try {
    const feeOptions = { serviceType: booking.service_type };
    cancellationFeeAmount = await getCustomerCancellationFeeAmount(25, feeOptions);
    noShowFeeAmount = await getCustomerNoShowFeeAmount(25, feeOptions);
  } catch (err) {
    logger.warn('booking_cancel_fee_lookup_failed', { message: err?.message });
  }
  const by = String(cancelledBy || '').toLowerCase();

  if (by === 'admin' || by === 'driver') {
    return {
      policy: 'full_refund',
      cancellation_fee: 0,
      refund_amount: null,
      message: by === 'driver' ? 'Full refund — service provider cancelled the booking.' : 'Full refund — cancelled by admin.',
    };
  }

  const status = String(booking.status || '').trim();
  const scheduledAt = booking.scheduled_at ? new Date(booking.scheduled_at) : null;
  const minutesToScheduled =
    scheduledAt && Number.isFinite(scheduledAt.getTime())
      ? (scheduledAt.getTime() - now.getTime()) / (60 * 1000)
      : null;

  const isServiceStarted = status === 'in_progress' || status === 'completed';
  if (isServiceStarted) {
    return {
      policy: 'no_refund',
      cancellation_fee: 0,
      refund_amount: 0,
      message: 'No refund if service has started.',
    };
  }

  const isScheduled = String(booking.schedule_type || '').trim() === 'scheduled';
  const insideScheduledFeeWindow =
    isScheduled &&
    minutesToScheduled !== null &&
    Number.isFinite(minutesToScheduled) &&
    minutesToScheduled >= 0 &&
    minutesToScheduled <= SCHEDULED_CANCEL_FEE_WINDOW_MINUTES;

  if (insideScheduledFeeWindow) {
    return {
      policy: 'fee',
      fee_reason: 'scheduled_window',
      cancellation_fee: cancellationFeeAmount,
      refund_amount: null,
      message: `$${cancellationFeeAmount} cancellation fee for cancelling within 2 hours of the scheduled service time.`,
    };
  }

  if (isProviderWaitingAtPickup(booking)) {
    return {
      policy: 'fee',
      fee_reason: 'waiting_at_pickup',
      cancellation_fee: noShowFeeAmount,
      refund_amount: null,
      message: `$${noShowFeeAmount} no-show fee while the provider is waiting at the pickup location.`,
    };
  }

  const enRouteNearPickup = await isProviderWithinMinutesOfPickup(booking);
  if (enRouteNearPickup) {
    return {
      policy: 'fee',
      fee_reason: 'en_route_near_pickup',
      cancellation_fee: noShowFeeAmount,
      refund_amount: null,
      message: `$${noShowFeeAmount} no-show fee when the provider is within 15 minutes of pickup.`,
    };
  }

  return {
    policy: 'full_refund',
    cancellation_fee: 0,
    refund_amount: null,
    message: 'Free cancellation.',
  };
}

async function processStripeCancellationRefunds({
  booking,
  userId,
  pendingTxn,
  paidTxn,
  refundAmount,
  refundRequestId,
  policy,
}) {
  if (pendingTxn?.stripe_payment_intent_id) {
    try {
      const stripe = await getStripe();
      await stripe.paymentIntents.cancel(String(pendingTxn.stripe_payment_intent_id));
    } catch (_e) {
      // best-effort
    }
  }

  let refundStatus = 'none';
  if (refundAmount > 0 && paidTxn?.stripe_payment_intent_id && refundRequestId) {
    try {
      const stripe = await getStripe();
      const idempotencyKey = `refund_booking_${booking.id}_${paidTxn.transaction_code || paidTxn.id}_${refundRequestId}`;

      const refund = await stripe.refunds.create(
        {
          payment_intent: String(paidTxn.stripe_payment_intent_id),
          amount: toMinorUnits(refundAmount),
          metadata: {
            booking_id: String(booking.id),
            booking_code: booking.booking_code ? String(booking.booking_code) : '',
            refund_request_id: String(refundRequestId),
            cancellation_policy: String(policy?.policy || ''),
          },
        },
        { idempotencyKey }
      );

      await db.RefundRequest.update(
        { status: 'refunded', stripe_refund_id: refund.id, stripe_payload: refund },
        { where: { id: refundRequestId, user_id: userId } }
      );
      refundStatus = 'refunded';
    } catch (err) {
      await db.RefundRequest.update(
        {
          stripe_payload: {
            error: { message: err?.message, type: err?.type, code: err?.code, statusCode: err?.statusCode },
          },
        },
        { where: { id: refundRequestId, user_id: userId } }
      ).catch(() => {});
      refundStatus = 'processing';
    }
  }

  return refundStatus;
}

/**
 * Core cancellation: DB status, wallet reversal, refunds, socket tracking update.
 */
async function performBookingCancellation({
  bookingId,
  cancelledBy,
  reason = null,
  customerUserId = null,
  driverUserId = null,
  now = new Date(),
  policyOverride = null,
}) {
  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'bookingId must be a positive integer');

  const where = { id };
  if (customerUserId) where.user_id = Number(customerUserId);
  if (driverUserId) where.assigned_driver_user_id = Number(driverUserId);

  const t = await db.sequelize.transaction();
  let booking;
  let paidTxn = null;
  let pendingTxn = null;
  let policy;
  let refundAmount = 0;
  let paidAmount = 0;
  let refundRequestId = null;
  let walletReversal = null;
  let txnUserId = null;
  const refundUserId = customerUserId ? Number(customerUserId) : null;

  try {
    booking = await db.Booking.findOne({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!booking) throw new HttpError(404, 'Booking not found');

    if (booking.status === 'cancelled') throw new HttpError(409, 'Booking already cancelled');
    if (booking.status === 'completed') throw new HttpError(409, 'Completed bookings cannot be cancelled');
    if (!CANCELLABLE_STATUSES.has(String(booking.status))) {
      throw new HttpError(400, `Booking in status "${booking.status}" cannot be cancelled`);
    }

    assertCancellationAllowedForHandover(booking, cancelledBy);

    const previousStatus = booking.status;
    const previousTracking = String(booking.tracking_status || '').trim().toUpperCase();
    policy =
      policyOverride && typeof policyOverride === 'object'
        ? policyOverride
        : await computePolicy({ booking, cancelledBy, now });

    txnUserId = refundUserId || Number(booking.user_id);
    paidTxn = await db.BookingTransaction.findOne({
      where: { booking_id: booking.id, user_id: txnUserId, status: 'succeeded' },
      order: [['created_at', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    pendingTxn = await db.BookingTransaction.findOne({
      where: {
        booking_id: booking.id,
        user_id: txnUserId,
        status: ['processing', 'requires_action', 'requires_payment_method'],
      },
      order: [['created_at', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    paidAmount = paidTxn ? Number(paidTxn.amount || 0) : 0;

    if (policy.policy === 'no_refund') {
      refundAmount = 0;
    } else if (!paidTxn) {
      refundAmount = 0;
    } else if (policy.policy === 'fee') {
      refundAmount = Math.max(0, paidAmount - Number(policy.cancellation_fee || 0));
    } else {
      refundAmount = Math.max(0, paidAmount);
    }

    await booking.update(
      {
        status: 'cancelled',
        tracking_status: 'BOOKING_CANCELLED',
        cancelled_at: now,
        cancelled_by: cancelledBy,
        cancellation_reason: reason ? String(reason) : null,
        cancellation_fee: Number(policy.cancellation_fee || 0),
        refund_amount: Number(refundAmount || 0),
        ...(cancelledBy === 'admin' && reason
          ? { admin_cancellation_reason: String(reason) }
          : {}),
      },
      { transaction: t }
    );
    await booking.reload({ transaction: t });

    walletReversal = await handleBookingStatusWalletTransition({
      booking,
      previousStatus,
      transaction: t,
    });

    const cancellationFee = Number(policy.cancellation_fee || 0);
    const noShowProviderShareReasons = new Set([
      'en_route_near_pickup',
      'waiting_at_pickup',
      'customer_no_show',
    ]);
    const bookingBeforeCancel = {
      ...booking.get({ plain: true }),
      status: previousStatus,
      tracking_status: previousTracking,
    };
    const qualifiesForNoShowProviderShare =
      noShowProviderShareReasons.has(policy.fee_reason) ||
      isProviderWaitingAtPickup(bookingBeforeCancel) ||
      (await isProviderWithinMinutesOfPickup(bookingBeforeCancel));
    let providerCancellationShare = 0;
    if (policy.policy === 'fee' && cancellationFee > 0 && qualifiesForNoShowProviderShare) {
      const shareResult = await creditProviderEnRouteCancellationShare({
        booking,
        cancellationFee,
        feeReason: policy.fee_reason,
        transaction: t,
      });
      if (shareResult?.credited) {
        providerCancellationShare = Number(shareResult.amount || 0);
        await booking.update(
          { provider_cancellation_share_amount: providerCancellationShare },
          { transaction: t }
        );
      }
    }

    if (pendingTxn) {
      await pendingTxn.update({ status: 'cancelled' }, { transaction: t });
    }

    if (refundAmount > 0 && paidTxn && txnUserId) {
      const rr = await db.RefundRequest.create(
        {
          booking_transaction_id: paidTxn.id,
          booking_id: booking.id,
          user_id: txnUserId,
          amount: refundAmount,
          reason: reason ? String(reason) : null,
          status: 'processing',
        },
        { transaction: t }
      );
      refundRequestId = rr.id;
    }

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }

  let refundStatus = 'none';
  if (refundRequestId && txnUserId) {
    refundStatus = await processStripeCancellationRefunds({
      booking,
      userId: txnUserId,
      pendingTxn,
      paidTxn,
      refundAmount,
      refundRequestId,
      policy,
    });
  } else if (pendingTxn) {
    await processStripeCancellationRefunds({
      booking,
      userId: txnUserId || booking.user_id,
      pendingTxn,
      paidTxn: null,
      refundAmount: 0,
      refundRequestId: null,
      policy,
    });
  }

  try {
    const { cancelScheduledReminderJobsForBooking } = require('../modules/queues/notification.queue');
    await cancelScheduledReminderJobsForBooking(booking.id);
  } catch (err) {
    logger.warn('booking_cancel_reminder_jobs_failed', {
      bookingId: booking.id,
      message: err?.message,
    });
  }

  try {
    const { cancelAllBookingTimers } = require('./bookingTimer.service');
    await cancelAllBookingTimers(booking.id);
  } catch (err) {
    logger.warn('booking_cancel_timer_jobs_failed', {
      bookingId: booking.id,
      message: err?.message,
    });
  }

  try {
    await notifyBookingCancelled(booking, {
      cancelledBy,
      reason,
      refundAmount: booking.refund_amount,
      cancellationFee: booking.cancellation_fee,
      walletReversal,
    });
  } catch (err) {
    logger.error('booking_cancel_notify_failed', {
      bookingId: booking.id,
      message: err?.message,
    });
  }

  let driver_earning = null;
  try {
    const { buildDriverEarningSummary } = require('../utils/bookingDriverEarning');
    driver_earning = await buildDriverEarningSummary({ booking: booking.get({ plain: true }) });
  } catch (err) {
    logger.warn('booking_cancel_driver_earning_failed', {
      bookingId: booking.id,
      message: err?.message,
    });
  }

  return {
    booking_id: booking.id,
    status: 'cancelled',
    cancelled_at: booking.cancelled_at,
    cancelled_by: cancelledBy,
    cancellation_fee: Number(booking.cancellation_fee || 0),
    provider_cancellation_share_amount: Number(booking.provider_cancellation_share_amount || 0),
    refund_amount: Number(booking.refund_amount || 0),
    paid_amount: Number(paidAmount || 0),
    refund_status: refundStatus,
    policy: policy?.policy || null,
    policy_message: policy?.message || null,
    wallet_reversal: walletReversal,
    driver_earning,
  };
}

async function cancelBookingAsCustomer({ bookingId, userId, reason, now = new Date() }) {
  if (!userId) throw new HttpError(401, 'Unauthorized');
  return performBookingCancellation({
    bookingId,
    cancelledBy: 'customer',
    reason,
    customerUserId: userId,
    now,
  });
}

async function cancelBookingAsDriver({ bookingId, driverUserId, reason, now = new Date() }) {
  if (!driverUserId) throw new HttpError(401, 'Unauthorized');
  return performBookingCancellation({
    bookingId,
    cancelledBy: 'driver',
    reason,
    driverUserId,
    now,
  });
}

async function cancelBookingAsAdmin({ bookingId, reason, now = new Date() }) {
  const booking = await db.Booking.findByPk(bookingId, { attributes: ['id', 'user_id'] });
  if (!booking) throw new HttpError(404, 'Booking not found');
  return performBookingCancellation({
    bookingId,
    cancelledBy: 'admin',
    reason,
    customerUserId: booking.user_id,
    now,
  });
}

module.exports = {
  cancelBookingAsCustomer,
  cancelBookingAsDriver,
  cancelBookingAsAdmin,
  performBookingCancellation,
  computePolicy,
  processStripeCancellationRefunds,
  sumRefundAmountsForBooking,
  computeNoShowRefundAndFee,
};
