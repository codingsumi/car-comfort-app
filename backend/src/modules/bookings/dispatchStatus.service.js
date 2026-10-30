const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { logger } = require('../../config/logger');
const { addSendNotificationJob } = require('../queues/notification.queue');
const { notifyCustomerBookingDispatchStatus } = require('../../services/bookingCustomerNotify.service');

const DISPATCH_BODY = new Set(['ENROUTE', 'ARRIVED']);

function parseBookingId(idRaw) {
  const id = Number.parseInt(String(idRaw), 10);
  if (!id || id < 1) throw new HttpError(400, 'booking id is invalid');
  return id;
}

async function applyDispatchTrackingStatus(bookingIdRaw, rawStatus, auth) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Forbidden');

  const bookingId = parseBookingId(bookingIdRaw);
  const status = String(rawStatus || '').trim().toUpperCase();
  if (!DISPATCH_BODY.has(status)) throw new HttpError(400, 'Invalid status');

  const booking = await db.Booking.findByPk(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');

  const actor = Number(auth.userId);
  const assigned = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  if (!assigned || assigned !== actor) {
    throw new HttpError(403, 'Forbidden');
  }

  const bad = ['cancelled', 'completed', 'draft', 'pending_payment'];
  if (bad.includes(String(booking.status))) {
    throw new HttpError(409, 'Booking is not eligible for dispatch updates');
  }

  if (status === 'ENROUTE') {
    await booking.update({ tracking_status: 'enroute' });
    await db.NotificationState.upsert({
      booking_id: booking.id,
      enroute_active: true,
      last_notified_at: null,
      last_distance_bucket: null
    });
    notifyCustomerBookingDispatchStatus({
      bookingId: booking.id,
      driverUserId: actor,
      dispatchStatus: 'ENROUTE'
    }).catch((err) => {
      logger.error('dispatch_enroute_customer_realtime_failed', {
        bookingId: booking.id,
        driverUserId: actor,
        message: err?.message,
        stack: err?.stack
      });
    });
    return { booking_id: booking.id, tracking_status: 'enroute', enroute_active: true };
  }

  await booking.update({ tracking_status: 'arrived' });
  await db.NotificationState.update({ enroute_active: false }, { where: { booking_id: booking.id } });

  const customerId = Number(booking.customer_id || booking.user_id || 0);
  const providerId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  const targets = [...new Set([customerId, providerId].filter((n) => n > 0))];

  await Promise.all(
    targets.map((uid) =>
      addSendNotificationJob({
        notificationType: 'ARRIVED',
        bookingId: booking.id,
        userId: uid,
        uniqueKey: `${booking.id}:ARRIVED:user:${uid}`,
        meta: {}
      })
    )
  );

  notifyCustomerBookingDispatchStatus({
    bookingId: booking.id,
    driverUserId: actor,
    dispatchStatus: 'ARRIVED'
  }).catch((err) => {
    logger.error('dispatch_arrived_customer_realtime_failed', {
      bookingId: booking.id,
      driverUserId: actor,
      message: err?.message,
      stack: err?.stack
    });
  });

  return { booking_id: booking.id, tracking_status: 'arrived', enroute_active: false, notifications_queued: targets.length };
}

module.exports = { applyDispatchTrackingStatus };
