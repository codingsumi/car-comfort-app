const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { haversineMeters } = require('../utils/haversine');
const { distanceToBucket } = require('../utils/distanceBucket');
const { loadNotificationConfig } = require('../configs/notification.config');
const { addSendNotificationJob } = require('../queues/notification.queue');
const { publishDriverLocationRealtime } = require('../realtime/locationPublisher');
const { recordDriverGeoPosition } = require('./driverGeo.store');
const { logger } = require('../../config/logger');

function nums(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate driver → persist location → (optional) notification queue jobs → throttled realtime broadcast.
 * Realtime uses Redis + Socket.IO emitter; failures never fail the HTTP response.
 */
async function ingestDriverLocation({ booking_id: bookingId, provider_id: providerId, lat, lng, auth }) {
  const bid = nums(bookingId);
  const pid = nums(providerId);
  const latitude = nums(lat);
  const longitude = nums(lng);
  if (!bid || bid < 1) throw new HttpError(400, 'booking_id is invalid');
  if (!pid || pid < 1) throw new HttpError(400, 'provider_id is invalid');
  if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new HttpError(400, 'lat/lng invalid');
  }
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Forbidden');
  if (Number(auth.userId) !== pid) throw new HttpError(403, 'provider_id does not match auth');

  const booking = await db.Booking.findByPk(bid);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (['cancelled', 'completed'].includes(String(booking.status))) {
    throw new HttpError(409, 'Booking is not eligible for location updates');
  }

  const assigned = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  if (!assigned || assigned !== pid) throw new HttpError(403, 'Forbidden');

  await db.DriverLocation.create({
    booking_id: bid,
    provider_id: pid,
    lat: latitude,
    lng: longitude
  });

  recordDriverGeoPosition(pid, latitude, longitude).catch((err) => {
    logger.warn('recordDriverGeoPosition failed', { providerId: pid, message: err?.message });
  });

  let realtime = { published: false };
  try {
    realtime = await publishDriverLocationRealtime({
      bookingId: bid,
      providerId: pid,
      lat: latitude,
      lng: longitude
    });
  } catch (err) {
    logger.warn('publishDriverLocationRealtime failed', { bookingId: bid, message: err?.message });
    realtime = { published: false, reason: 'error' };
  }

  const stateRow = await db.NotificationState.findOne({ where: { booking_id: bid } });
  if (!stateRow?.enroute_active) {
    return {
      ok: true,
      queued: false,
      reason: 'enroute inactive',
      realtime
    };
  }

  const slat = nums(booking.service_lat ?? booking.service_latitude ?? booking.latitude);
  const slng = nums(booking.service_lng ?? booking.service_longitude ?? booking.longitude);
  if (slat == null || slng == null) {
    return {
      ok: true,
      queued: false,
      reason: 'booking missing service coordinates',
      realtime
    };
  }

  const distanceM = haversineMeters(latitude, longitude, slat, slng);
  const bucket = distanceToBucket(distanceM);
  const cfg = loadNotificationConfig();
  const repeatMs = Math.max(cfg.enrouteRepeatMs, 60000);
  const windowId = Math.floor(Date.now() / repeatMs);

  const bucketChanged = String(stateRow.last_distance_bucket || '') !== bucket;
  const lastAt = stateRow.last_notified_at ? new Date(stateRow.last_notified_at).getTime() : null;
  const stale = lastAt == null || Date.now() - lastAt >= cfg.enrouteRepeatMs;

  if (!bucketChanged && !stale) {
    return {
      ok: true,
      queued: false,
      reason: 'no_notification_trigger',
      realtime
    };
  }

  const customerId = nums(booking.customer_id || booking.user_id);
  if (!customerId) {
    return {
      ok: true,
      queued: false,
      reason: 'no_customer',
      realtime
    };
  }

  const uniqueKey = `${bid}:ENROUTE_UPDATE:${bucket}:w${windowId}`;

  await addSendNotificationJob({
    notificationType: 'ENROUTE_UPDATE',
    bookingId: bid,
    userId: customerId,
    uniqueKey,
    meta: { bucket, distanceM, windowId }
  });

  return {
    ok: true,
    queued: true,
    bucket,
    distance_m: Math.round(distanceM * 100) / 100,
    realtime
  };
}

module.exports = { ingestDriverLocation };
