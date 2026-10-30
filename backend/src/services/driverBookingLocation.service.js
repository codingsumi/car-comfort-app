'use strict';

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const {
  resetTrackingAfterAlternateServiceLocation
} = require('../modules/bookings/bookingTracking.service');

const ALLOWED_STATUSES = new Set(['confirmed', 'assigned', 'in_progress']);
const EV_SERVICE_TYPES = new Set(['ev_charging', 'combo']);

function parseBookingId(bookingId) {
  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'bookingId must be a positive integer');
  return id;
}

function parseDriverId(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');
  return userId;
}

function normalizeServiceLocation(body) {
  const service_address = String(body?.service_address || '').trim();
  if (!service_address) throw new HttpError(400, 'service_address is required');

  const latRaw = body?.service_latitude;
  const lngRaw = body?.service_longitude;
  if (latRaw === undefined || latRaw === null || latRaw === '' || lngRaw === undefined || lngRaw === null || lngRaw === '') {
    throw new HttpError(400, 'service_latitude and service_longitude are required');
  }

  const service_latitude = Number(latRaw);
  const service_longitude = Number(lngRaw);
  if (!Number.isFinite(service_latitude) || service_latitude < -90 || service_latitude > 90) {
    throw new HttpError(400, 'service_latitude must be between -90 and 90');
  }
  if (!Number.isFinite(service_longitude) || service_longitude < -180 || service_longitude > 180) {
    throw new HttpError(400, 'service_longitude must be between -180 and 180');
  }

  const reason =
    body?.reason === undefined || body?.reason === null
      ? null
      : String(body.reason).trim().slice(0, 500) || null;

  return { service_address, service_latitude, service_longitude, reason };
}

function formatServiceLocation(booking) {
  const plain = booking.get ? booking.get({ plain: true }) : booking;
  return {
    address: plain.service_address ?? null,
    latitude:
      plain.service_latitude === null || plain.service_latitude === undefined
        ? null
        : Number(plain.service_latitude),
    longitude:
      plain.service_longitude === null || plain.service_longitude === undefined
        ? null
        : Number(plain.service_longitude)
  };
}

async function logTimeline({ bookingId, driverUserId, message, metadata }) {
  try {
    await db.BookingTimeline.create({
      booking_id: bookingId,
      event_type: 'service_location_updated',
      message,
      actor_type: 'driver',
      actor_id: driverUserId,
      metadata
    });
  } catch (err) {
    logger.warn('driver_service_location_timeline_failed', {
      bookingId,
      message: err?.message
    });
  }
}

async function notifyCustomerServiceLocationUpdated({ booking, reason }) {
  const plain = booking.get ? booking.get({ plain: true }) : booking;
  const customerId = Number(plain.customer_id || plain.user_id || 0);
  if (!customerId) return;

  const location = formatServiceLocation(plain);
  const message =
    reason ||
    'Your service location was updated by the service provider because the previous location was not available or serviceable.';

  emitToCustomer(customerId, 'booking_service_location_updated', {
    booking_id: plain.id,
    booking_code: plain.booking_code ?? null,
    message,
    service_location: location,
    updated_at: new Date().toISOString()
  });

  sendPushToUser(customerId, {
    title: 'Service location updated',
    body: message,
    data: {
      kind: 'SERVICE_LOCATION_UPDATED',
      booking_id: String(plain.id),
      booking_code: plain.booking_code != null ? String(plain.booking_code) : ''
    }
  }).catch((err) => {
    logger.warn('driver_service_location_push_failed', {
      bookingId: plain.id,
      customerId,
      message: err?.message
    });
  });
}

/**
 * Assigned driver updates where the service will be performed (e.g. original spot not serviceable).
 */
async function updateServiceLocationByDriver({ bookingId, auth, body }) {
  const id = parseBookingId(bookingId);
  const driverUserId = parseDriverId(auth);
  const location = normalizeServiceLocation(body);

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: driverUserId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');

  const booking = await db.Booking.findOne({
    where: {
      id,
      assigned_driver_user_id: driverUserId
    }
  });
  if (!booking) throw new HttpError(404, 'Booking not found');

  if (!ALLOWED_STATUSES.has(String(booking.status))) {
    throw new HttpError(400, 'Service location cannot be changed for this booking status');
  }

  const previous = formatServiceLocation(booking);

  const updates = {
    service_address: location.service_address,
    service_latitude: location.service_latitude,
    service_longitude: location.service_longitude,
    service_lat: location.service_latitude,
    service_lng: location.service_longitude
  };

  if (EV_SERVICE_TYPES.has(String(booking.service_type))) {
    updates.ev_charging_address = location.service_address;
    updates.charging_latitude = location.service_latitude;
    updates.charging_longitude = location.service_longitude;
  }

  await booking.update(updates);
  await booking.reload();

  const trackingReset = await resetTrackingAfterAlternateServiceLocation(
    booking,
    driverUserId
  );
  if (trackingReset.changed) {
    await booking.reload();
  }

  const timelineMessage = location.reason
    ? `Service provider updated service location: ${location.reason}`
    : 'Service provider updated service location (previous spot not serviceable)';

  await logTimeline({
    bookingId: id,
    driverUserId,
    message: timelineMessage,
    metadata: {
      previous,
      updated: formatServiceLocation(booking),
      reason: location.reason
    }
  });

  notifyCustomerServiceLocationUpdated({ booking, reason: location.reason }).catch(() => {});

  return {
    booking_id: booking.id,
    booking_code: booking.booking_code,
    status: booking.status,
    tracking_status: booking.tracking_status ?? trackingReset.tracking_status,
    tracking_status_reset: trackingReset.changed,
    service_location: formatServiceLocation(booking),
    previous_service_location: previous
  };
}

module.exports = { updateServiceLocationByDriver };
