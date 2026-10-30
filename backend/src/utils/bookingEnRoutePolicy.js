'use strict';

const db = require('../models');
const { haversineMeters } = require('../modules/utils/haversine');
const { resolveTrackingStatusRank } = require('../modules/bookings/trackingStatuses');
const {
  EN_ROUTE_FEE_ETA_MINUTES,
  EN_ROUTE_ETA_SPEED_M_PER_MIN,
} = require('../constants/bookingNotification.constants');

const DRIVER_STARTED_RANK = resolveTrackingStatusRank('DRIVER_STARTED_TO_CUSTOMER');
const NEAR_CUSTOMER_RANK = resolveTrackingStatusRank('DRIVER_NEAR_CUSTOMER');
const WAITING_AT_PICKUP_STATUSES = new Set(['DRIVER_REACHED_CUSTOMER', 'OTP_PENDING']);

function bookingPickupCoordinates(booking) {
  const lat = Number(
    booking.service_latitude ?? booking.service_lat ?? booking.latitude ?? booking.pickup_latitude
  );
  const lng = Number(
    booking.service_longitude ?? booking.service_lng ?? booking.longitude ?? booking.pickup_longitude
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function estimateDrivingMinutes(distanceMeters) {
  const meters = Number(distanceMeters);
  if (!Number.isFinite(meters) || meters < 0) return null;
  return meters / EN_ROUTE_ETA_SPEED_M_PER_MIN;
}

function isDriverEnRouteByTracking(booking) {
  const tracking = String(booking.tracking_status || '').trim().toUpperCase();
  if (!tracking) return false;
  if (tracking === 'ENROUTE' || tracking === 'EN_ROUTE') return true;
  const rank = resolveTrackingStatusRank(tracking);
  if (rank < 0 || DRIVER_STARTED_RANK < 0) return false;
  return rank >= DRIVER_STARTED_RANK && rank < resolveTrackingStatusRank('OTP_VERIFIED');
}

/** Provider has arrived and is in the 0–15 min customer contact / wait window at pick-up. */
function isProviderWaitingAtPickup(booking) {
  const tracking = String(booking.tracking_status || '').trim().toUpperCase();
  return WAITING_AT_PICKUP_STATUSES.has(tracking);
}

/**
 * True when provider is heading to pickup and estimated arrival is within [minutes] (default 15).
 * Excludes the waiting-at-pickup state (handled separately).
 */
async function isProviderWithinMinutesOfPickup(booking, minutes = EN_ROUTE_FEE_ETA_MINUTES) {
  if (isProviderWaitingAtPickup(booking)) return false;
  if (!isDriverEnRouteByTracking(booking)) return false;

  const tracking = String(booking.tracking_status || '').trim().toUpperCase();
  const rank = resolveTrackingStatusRank(tracking);
  if (NEAR_CUSTOMER_RANK >= 0 && rank >= NEAR_CUSTOMER_RANK) {
    return true;
  }

  const pickup = bookingPickupCoordinates(booking);
  const providerId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  if (!pickup || !providerId) return false;

  const latest = await db.DriverLocation.findOne({
    where: { booking_id: Number(booking.id), provider_id: providerId },
    order: [['created_at', 'DESC']],
    attributes: ['lat', 'lng'],
  });

  if (!latest) return false;

  const distanceM = haversineMeters(
    Number(latest.lat),
    Number(latest.lng),
    pickup.lat,
    pickup.lng
  );
  const etaMinutes = estimateDrivingMinutes(distanceM);
  if (etaMinutes == null) return false;
  return etaMinutes <= minutes;
}

module.exports = {
  bookingPickupCoordinates,
  estimateDrivingMinutes,
  isDriverEnRouteByTracking,
  isProviderWaitingAtPickup,
  isProviderWithinMinutesOfPickup,
};
