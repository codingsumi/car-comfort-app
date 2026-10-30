'use strict';

const db = require('../../models');
const { logger } = require('../../config/logger');
const { emitToBookingRoom } = require('../realtime/bookingRoomEmitter');
const { emitToCustomer } = require('../realtime/customerSocketEmitter');
const { driverRoom } = require('../realtime/newBookingSocketEmitter');
const { getIoEmitter } = require('../realtime/locationPublisher');
const { ensureInboxNotification } = require('../notifications/inboxNotification.service');
const { sendPushToUser } = require('../notifications/push.provider');
const { isOneSignalConfigured } = require('../../config/onesignal');
const { notifyDriverBookingCancelled } = require('../../services/driverNotify.service');

const TRACKING_STATUS_CANCELLED = 'BOOKING_CANCELLED';

function resolveCustomerId(booking) {
  const cid = Number(booking.customer_id || booking.user_id || 0);
  return cid > 0 ? cid : null;
}

async function loadDriverDetails(driverUserId) {
  const uid = Number(driverUserId);
  if (!uid) return null;
  const user = await db.User.findByPk(uid, { attributes: ['id', 'name', 'phone'] });
  if (!user) return { user_id: uid, name: null, profile_picture: null };
  const profile = await db.DriverProfile.findOne({
    where: { user_id: uid },
    attributes: ['profile_picture'],
  });
  return {
    user_id: uid,
    name: user.name != null ? String(user.name) : null,
    profile_picture: profile?.profile_picture != null ? String(profile.profile_picture) : null,
  };
}

function cancellationMessage(cancelledBy) {
  switch (String(cancelledBy || '').toLowerCase()) {
    case 'customer':
      return 'The customer has cancelled this booking.';
    case 'driver':
      return 'The service provider has cancelled this booking.';
    case 'admin':
      return 'This booking has been cancelled by support.';
    default:
      return 'This booking has been cancelled.';
  }
}

/**
 * Persist tracking log + emit booking_tracking_update to booking room, customer, and assigned driver.
 */
async function notifyBookingCancelled(booking, {
  cancelledBy,
  reason = null,
  refundAmount = null,
  cancellationFee = null,
  walletReversal = null,
} = {}) {
  const plain = booking.get ? booking.get({ plain: true }) : booking;
  const bookingId = Number(plain.id);
  if (!bookingId) return { skipped: true, reason: 'no_booking_id' };

  const message = cancellationMessage(cancelledBy);
  const updatedAt = new Date().toISOString();
  const driverUserId = Number(plain.assigned_driver_user_id || plain.provider_id || 0);
  const driver = driverUserId > 0 ? await loadDriverDetails(driverUserId) : null;

  if (String(plain.tracking_status || '') !== TRACKING_STATUS_CANCELLED) {
    await db.Booking.update(
      { tracking_status: TRACKING_STATUS_CANCELLED },
      { where: { id: bookingId } }
    );
  }

  let logId = null;
  try {
    const logEntry = await db.BookingTrackingLog.create({
      booking_id: bookingId,
      tracking_status: TRACKING_STATUS_CANCELLED,
      message,
      metadata: {
        cancelled_by: cancelledBy,
        reason: reason || null,
        refund_amount: refundAmount,
        cancellation_fee: cancellationFee,
        wallet_reversal: walletReversal,
      },
    });
    logId = logEntry.id;
  } catch (err) {
    logger.error('booking_cancel_tracking_log_failed', { bookingId, message: err?.message });
  }

  const socketPayload = {
    booking_id: bookingId,
    tracking_status: TRACKING_STATUS_CANCELLED,
    booking_status: 'cancelled',
    cancelled_by: cancelledBy,
    message,
    reason: reason || null,
    refund_amount: refundAmount != null ? Number(refundAmount) : Number(plain.refund_amount || 0),
    cancellation_fee:
      cancellationFee != null ? Number(cancellationFee) : Number(plain.cancellation_fee || 0),
    driver,
    updated_at: updatedAt,
  };

  emitToBookingRoom(bookingId, 'booking_tracking_update', socketPayload);

  const customerId = resolveCustomerId(plain);
  if (customerId) {
    emitToCustomer(customerId, 'booking_tracking_update', socketPayload);
    emitToCustomer(customerId, 'booking_status_update', {
      booking_id: bookingId,
      booking_status: 'CANCELLED',
      message,
      updated_at: updatedAt,
    });
  }

  if (driverUserId > 0) {
    try {
      getIoEmitter().of('/').to(driverRoom(driverUserId)).emit('booking_tracking_update', socketPayload);
    } catch (err) {
      logger.warn('booking_cancel_driver_emit_failed', {
        bookingId,
        driverUserId,
        message: err?.message,
      });
    }

    void notifyDriverBookingCancelled({
      bookingId,
      driverUserId,
      cancelledBy,
      message,
    }).catch((err) => {
      logger.error('booking_cancel_driver_notify_failed', {
        bookingId,
        driverUserId,
        message: err?.message,
      });
    });
  }

  const deliveryKey = `${bookingId}:CANCEL:${cancelledBy}`;
  if (customerId) {
    try {
      await ensureInboxNotification({
        userId: customerId,
        bookingId,
        notificationType: 'BOOKING_CANCELLED',
        deliveryKey,
        title: 'Booking cancelled',
        message,
        data: {
          kind: 'BOOKING_CANCELLED',
          booking_id: String(bookingId),
          cancelled_by: cancelledBy,
        },
      });
    } catch (err) {
      logger.error('booking_cancel_inbox_failed', { bookingId, customerId, message: err?.message });
    }

    if (isOneSignalConfigured()) {
      try {
        await sendPushToUser(customerId, {
          title: 'Booking cancelled',
          body: message,
          data: {
            kind: 'BOOKING_CANCELLED',
            booking_id: String(bookingId),
            cancelled_by: cancelledBy,
          },
          idempotencyKey: deliveryKey,
        });
      } catch (err) {
        logger.error('booking_cancel_push_failed', { bookingId, customerId, message: err?.message });
      }
    }
  }

  logger.info('booking_cancel_notified', {
    bookingId,
    cancelledBy,
    customerId: customerId || null,
    driverUserId: driverUserId || null,
    logId,
  });

  return { booking_id: bookingId, tracking_status: TRACKING_STATUS_CANCELLED, log_id: logId };
}

module.exports = {
  TRACKING_STATUS_CANCELLED,
  notifyBookingCancelled,
};
