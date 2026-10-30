'use strict';

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { getCustomerNoShowFeeAmount } = require('./bookingCharges.service');
const { processStripeCancellationRefunds, sumRefundAmountsForBooking, computeNoShowRefundAndFee } = require('./bookingCancellation.service');
const {
  reverseWalletOnBookingCancel,
  creditProviderEnRouteCancellationShare,
} = require('./providerWallet.service');
const { ARRIVAL_WAIT_WINDOW_MS } = require('../constants/bookingTimer.constants');
const {
  cancelArrivalWaitTimers,
  cancelAllBookingTimers,
  notifyBookingReturnedToBoard,
} = require('./bookingTimer.service');

const ALLOWED_TRACKING_FOR_NO_SHOW = new Set(['DRIVER_REACHED_CUSTOMER', 'OTP_PENDING']);

function assertNoShowEligible(booking) {
  if (!['assigned', 'in_progress'].includes(String(booking.status))) {
    throw new HttpError(409, 'Booking is not eligible for customer no-show');
  }

  const tracking = String(booking.tracking_status || '').trim().toUpperCase();
  if (!ALLOWED_TRACKING_FOR_NO_SHOW.has(tracking)) {
    throw new HttpError(
      409,
      'Customer no-show can only be recorded after you have arrived at the pick-up location'
    );
  }

  const arrivedAt = booking.driver_arrived_customer_at
    ? new Date(booking.driver_arrived_customer_at)
    : null;
  if (!arrivedAt || !Number.isFinite(arrivedAt.getTime())) {
    throw new HttpError(409, 'Arrival time is not recorded for this booking');
  }

  const waitEndsAt = booking.arrival_wait_expires_at
    ? new Date(booking.arrival_wait_expires_at)
    : new Date(arrivedAt.getTime() + ARRIVAL_WAIT_WINDOW_MS);

  if (Date.now() < waitEndsAt.getTime()) {
    const minsLeft = Math.ceil((waitEndsAt.getTime() - Date.now()) / 60000);
    throw new HttpError(
      409,
      `Please wait ${minsLeft} more minute${minsLeft === 1 ? '' : 's'} before marking customer no-show`
    );
  }
}

async function markCustomerNoShowAsDriver({ bookingId, driverUserId, reason = null }) {
  const id = Number.parseInt(String(bookingId), 10);
  const driverId = Number(driverUserId);
  if (!id || id < 1) throw new HttpError(400, 'bookingId must be a positive integer');
  if (!driverId) throw new HttpError(401, 'Unauthorized');

  const precheck = await db.Booking.findByPk(id);
  if (!precheck) throw new HttpError(404, 'Booking not found');

  const assigned = Number(precheck.provider_id || precheck.assigned_driver_user_id || 0);
  if (assigned !== driverId) {
    throw new HttpError(403, 'You are not the assigned service provider for this booking');
  }
  assertNoShowEligible(precheck);

  let noShowFee = 25;
  try {
    noShowFee = await getCustomerNoShowFeeAmount(25, { serviceType: precheck.service_type });
  } catch (_e) {
    // use default
  }

  await cancelArrivalWaitTimers(id);

  const previousDriverId = driverId;
  const feePolicy = {
    policy: 'fee',
    fee_reason: 'customer_no_show',
    cancellation_fee: noShowFee,
  };
  const noShowReason = reason ? String(reason) : 'customer_no_show';

  const t = await db.sequelize.transaction();
  let booking;
  let paidTxn = null;
  let pendingTxn = null;
  let refundAmount = 0;
  let paidAmount = 0;
  let newlyRetainedFee = 0;
  let totalCancellationFee = Number(noShowFee || 0);
  let totalRefunded = 0;
  let refundRequestId = null;
  let providerCancellationShare = 0;
  const txnUserId = Number(precheck.user_id);

  try {
    booking = await db.Booking.findOne({
      where: { id, assigned_driver_user_id: driverId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!booking) throw new HttpError(404, 'Booking not found');
    assertNoShowEligible(booking);

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
    const alreadyRefunded = await sumRefundAmountsForBooking(booking.id, t);
    const feeBreakdown = computeNoShowRefundAndFee({
      paidAmount,
      noShowFee,
      alreadyRefunded,
      priorCancellationFee: booking.cancellation_fee,
    });
    refundAmount = feeBreakdown.refundAmount;
    newlyRetainedFee = feeBreakdown.newlyRetainedFee;
    totalCancellationFee = feeBreakdown.totalCancellationFee;
    totalRefunded = feeBreakdown.totalRefunded;
    feePolicy.cancellation_fee = newlyRetainedFee > 0 ? newlyRetainedFee : noShowFee;

    await reverseWalletOnBookingCancel({ booking, transaction: t }).catch((err) => {
      logger.warn('customer_no_show_wallet_reverse_failed', {
        bookingId: booking.id,
        message: err?.message,
      });
    });

    if (newlyRetainedFee > 0) {
      const shareResult = await creditProviderEnRouteCancellationShare({
        booking,
        cancellationFee: newlyRetainedFee,
        feeReason: 'customer_no_show',
        transaction: t,
      });
      if (shareResult?.credited) {
        providerCancellationShare = Number(shareResult.amount || 0);
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
          reason: noShowReason,
          status: 'processing',
        },
        { transaction: t }
      );
      refundRequestId = rr.id;
    }

    await booking.update(
      {
        assigned_driver_user_id: null,
        provider_id: null,
        status: 'confirmed',
        tracking_status: null,
        driver_accepted_at: null,
        on_demand_accept_deadline_at: null,
        scheduled_pickup_window_start_at: null,
        scheduled_pickup_deadline_at: null,
        pickup_otp: null,
        pickup_otp_expiry: null,
        driver_arrived_customer_at: null,
        arrival_wait_expires_at: null,
        cancellation_fee: totalCancellationFee,
        provider_cancellation_share_amount: providerCancellationShare,
        refund_amount: totalRefunded,
      },
      { transaction: t }
    );

    await t.commit();
    await booking.reload();
  } catch (err) {
    await t.rollback();
    throw err;
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
      policy: feePolicy,
    });
  } else if (pendingTxn) {
    await processStripeCancellationRefunds({
      booking,
      userId: txnUserId,
      pendingTxn,
      paidTxn: null,
      refundAmount: 0,
      refundRequestId: null,
      policy: feePolicy,
    });
  }

  try {
    await cancelAllBookingTimers(booking.id);
  } catch (err) {
    logger.warn('customer_no_show_cancel_timers_failed', {
      bookingId: booking.id,
      message: err?.message,
    });
  }

  const driverMessage =
    'Customer no-show recorded. This job has been returned to the job board for another provider.';
  const customerMessage =
    'Your assigned provider reported a no-show at pick-up. We are looking for another provider.';

  await notifyBookingReturnedToBoard(booking, {
    reason: 'customer_no_show',
    driverMessage,
    customerMessage,
    previousDriverId,
    socketKind: 'CUSTOMER_NO_SHOW',
  });

  let driver_earning = null;
  if (providerCancellationShare > 0) {
    driver_earning = {
      amount: providerCancellationShare,
      tip_amount: null,
      total_payout: providerCancellationShare,
      currency: 'usd',
      kind: 'no_show',
      payout_label: 'Customer no-show share',
      note:
        'Service was not completed. You receive the no-show fee share instead of the full service payout.',
      cancellation_fee: Number(newlyRetainedFee > 0 ? newlyRetainedFee : noShowFee || 0),
      planned_service_payout: null,
    };
  }

  const feeMessage =
    newlyRetainedFee > 0
      ? `$${newlyRetainedFee} customer no-show fee applied. Job returned to the board.`
      : 'Customer no-show recorded. Job returned to the board.';

  return {
    booking_id: booking.id,
    status: 'confirmed',
    reassigned: true,
    no_show_fee: newlyRetainedFee > 0 ? newlyRetainedFee : noShowFee,
    cancellation_reason: 'customer_no_show',
    cancellation_fee: totalCancellationFee,
    provider_cancellation_share_amount: providerCancellationShare,
    refund_amount: totalRefunded,
    paid_amount: Number(paidAmount || 0),
    refund_status: refundStatus,
    policy: feePolicy.policy,
    message: feeMessage,
    driver_earning,
  };
}

module.exports = { markCustomerNoShowAsDriver };
