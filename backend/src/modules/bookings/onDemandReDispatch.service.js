'use strict';

/**
 * onDemandReDispatch.service.js
 *
 * After a provider rejects an on-demand booking, offer it to the next eligible
 * provider within the 0-10 mile zone. If none available, widen to 50 miles.
 * The booking remains on the job board for all other providers regardless.
 */

const db = require('../../models');
const { logger } = require('../../config/logger');
const {
  bookingCoords,
  findDriversForOnDemandDispatch,
} = require('../driver/nearbyDriversForBooking.service');
const { filterDriversNotRejectedForBooking } = require('./bookingRejectionCache.service');
const {
  emitNewBookingAvailableToDrivers,
} = require('../realtime/newBookingSocketEmitter');
const { addNewBookingAlertJobs } = require('../queues/notification.queue');
const {
  buildSocketPayload,
} = require('./bookingCreatedNotify.service');
const {
  resolveEvChargingPackageRow,
  resolveComboServicePackageRow,
} = require('../../services/bookingPriceSummary.service');

/**
 * Re-dispatch an on-demand booking to the next eligible provider(s) after a rejection.
 *
 * Does NOT modify booking status — the booking stays `confirmed + unassigned` and
 * visible to everyone on the job board. This only sends targeted push + socket to
 * providers who haven't already rejected it.
 *
 * @param {object} opts
 * @param {number} opts.bookingId
 * @param {number} opts.excludeDriverUserId  The driver who just rejected
 */
async function reDispatchOnDemandToNextProvider({ bookingId, excludeDriverUserId }) {
  const id = Number(bookingId);
  const excludeId = Number(excludeDriverUserId);
  if (!id || id < 1) return { skipped: true, reason: 'invalid_booking_id' };

  const booking = await db.Booking.findByPk(id, {
    attributes: [
      'id', 'booking_code', 'status', 'service_type', 'schedule_type',
      'scheduled_at', 'service_datetime', 'service_address', 'address',
      'latitude', 'longitude', 'service_latitude', 'service_longitude',
      'service_lat', 'service_lng', 'charging_latitude', 'charging_longitude',
      'base_price', 'custom_package_name', 'service_duration_minutes',
      'package_id', 'provider_compensation_amount',
      'on_demand_provider_compensation_amount', 'provider_compensation_type',
      'provider_compensation_value', 'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value', 'total_price',
      'assigned_driver_user_id', 'user_id', 'customer_id',
    ],
    include: [
      { model: db.User, as: 'user', required: false, attributes: ['id', 'name', 'first_name', 'last_name', 'profile'] },
      {
        model: db.Package, as: 'package', required: false,
        attributes: [
          'id', 'name', 'base_price', 'duration_minutes',
          'provider_compensation_type', 'provider_compensation_value',
          'on_demand_provider_compensation_type', 'on_demand_provider_compensation_value',
        ],
      },
    ],
  });

  if (!booking) return { skipped: true, reason: 'booking_not_found' };

  const plain = booking.get({ plain: true });

  // Only re-dispatch confirmed, unassigned bookings
  if (String(plain.status || '').trim() !== 'confirmed') {
    return { skipped: true, reason: 'not_confirmed' };
  }
  if (plain.assigned_driver_user_id) {
    return { skipped: true, reason: 'already_assigned' };
  }

  const coords = bookingCoords(plain);
  if (!coords) {
    return { skipped: true, reason: 'no_coordinates' };
  }

  // Find eligible providers (0-10 mile zone first, fall back to 50)
  const { driverIds, radiusMiles } = await findDriversForOnDemandDispatch(coords.lat, coords.lng);

  // Exclude the driver who just rejected
  const candidateIds = excludeId > 0
    ? driverIds.filter((id2) => id2 !== excludeId)
    : driverIds;

  // Exclude all drivers who have previously rejected this booking
  const eligibleIds = await filterDriversNotRejectedForBooking({
    bookingId: id,
    driverUserIds: candidateIds,
  });

  if (!eligibleIds.length) {
    logger.info('on_demand_redispatch_no_eligible_drivers', {
      bookingId: id,
      excludeDriverUserId: excludeId,
      radiusMiles,
    });
    return { skipped: false, reason: 'no_eligible_drivers', radiusMiles, eligible: 0 };
  }

  // Build socket payload
  const evPackageRow =
    String(plain.service_type || '').trim() === 'combo'
      ? await resolveEvChargingPackageRow({ packageRow: plain.package })
      : null;
  const comboPackageRow =
    String(plain.service_type || '').trim() === 'combo'
      ? await resolveComboServicePackageRow({ packageRow: plain.package })
      : null;

  const payload = buildSocketPayload(plain, plain.package, evPackageRow, comboPackageRow);
  if (!payload) return { skipped: true, reason: 'no_payload' };

  // Socket: notify eligible providers
  await emitNewBookingAvailableToDrivers(eligibleIds, payload);

  // Push: send notification
  await addNewBookingAlertJobs({
    bookingId: id,
    driverUserIds: eligibleIds,
    bookingSummary: payload,
  });

  logger.info('on_demand_redispatch_sent', {
    bookingId: id,
    excludeDriverUserId: excludeId,
    radiusMiles,
    eligible: eligibleIds.length,
  });

  return { ok: true, radiusMiles, eligible: eligibleIds.length };
}

module.exports = { reDispatchOnDemandToNextProvider };
