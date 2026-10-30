const db = require('../../models');
const { logger } = require('../../config/logger');
const { ensureAbsoluteUrl } = require('../../utils/fileUpload');
const { normalizeProfile, getProfileImageFromProfile } = require('../../utils/walletLedger');
const {
  bookingCoords,
  findNearbyApprovedDriverUserIds,
  findDriversForOnDemandDispatch,
} = require('../driver/nearbyDriversForBooking.service');
const { emitNewBookingAvailableToDrivers, emitNewBookingToAllDrivers } = require('../realtime/newBookingSocketEmitter');
const { addNewBookingAlertJobs } = require('../queues/notification.queue');
const { filterDriversNotRejectedForBooking } = require('./bookingRejectionCache.service');

const { buildDriverJobMapSummary } = require('../../utils/driverJobMapSummary');
const {
  resolveEvChargingPackageRow,
  resolveComboServicePackageRow,
} = require('../../services/bookingPriceSummary.service');

function buildBasicInfo(bookingPlain, packageRow = null, evPackageRow = null, comboPackageRow = null) {
  const jobMap = buildDriverJobMapSummary(
    bookingPlain,
    packageRow,
    evPackageRow,
    comboPackageRow
  );
  return {
    booking_code: bookingPlain.booking_code ?? null,
    service_type: bookingPlain.service_type ?? null,
    schedule_type: bookingPlain.schedule_type ?? null,
    scheduled_at: bookingPlain.scheduled_at ?? null,
    service_datetime:
      bookingPlain.service_datetime ?? bookingPlain.scheduled_at ?? null,
    service_address: bookingPlain.service_address ?? bookingPlain.address ?? null,
    total_price: bookingPlain.total_price == null ? null : Number(bookingPlain.total_price),
    status: bookingPlain.status ?? null,
    package_id: jobMap.package_id,
    package_name: jobMap.package_name,
    service_duration_minutes: jobMap.service_duration_minutes,
    estimated_travel_minutes: jobMap.estimated_travel_minutes,
    estimated_completion_minutes: jobMap.estimated_completion_minutes,
    provider_earning: jobMap.provider_earning,
    provider_earning_display: jobMap.provider_earning_display,
  };
}

/** Customer snapshot for driver sockets / push summary (no req — uses PUBLIC_BASE_URL when path-relative). */
function buildCustomerPayload(bookingPlain) {
  const u = bookingPlain.user || null;
  const rawId = u?.id ?? bookingPlain.user_id ?? bookingPlain.customer_id ?? null;
  const id = rawId == null ? null : Number(rawId);
  if (!id || id < 1) return null;

  const name =
    (u?.name && String(u.name).trim()) ||
    [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const rawImage = getProfileImageFromProfile(normalizeProfile(u?.profile));
  const profile_image = rawImage ? ensureAbsoluteUrl(null, rawImage) : null;

  return { id, name, profile_image };
}

function buildSocketPayload(
  bookingPlain,
  packageRow = null,
  evPackageRow = null,
  comboPackageRow = null
) {
  const coords = bookingCoords(bookingPlain);
  if (!coords) return null;
  const serviceDatetime =
    bookingPlain.service_datetime || bookingPlain.scheduled_at || null;
  return {
    booking_id: Number(bookingPlain.id),
    lat: coords.lat,
    lng: coords.lng,
    service_datetime: serviceDatetime,
    basic_info: buildBasicInfo(bookingPlain, packageRow, evPackageRow, comboPackageRow),
    customer: buildCustomerPayload(bookingPlain)
  };
}

/**
 * BOOKING_CREATED — after payment success: nearby drivers, realtime socket, push via queue (no DB notification row).
 */
async function notifyNearbyDriversBookingCreated(bookingId) {
  const id = Number(bookingId);
  if (!id) return { skipped: true, reason: 'invalid_id' };

  const booking = await db.Booking.findByPk(id, {
    attributes: [
      'id',
      'user_id',
      'customer_id',
      'booking_code',
      'status',
      'service_type',
      'schedule_type',
      'scheduled_at',
      'service_datetime',
      'service_address',
      'address',
      'latitude',
      'longitude',
      'service_latitude',
      'service_longitude',
      'service_lat',
      'service_lng',
      'charging_latitude',
      'charging_longitude',
      'base_price',
      'custom_package_name',
      'service_duration_minutes',
      'package_id',
      'provider_compensation_amount',
      'on_demand_provider_compensation_amount',
      'provider_compensation_type',
      'provider_compensation_value',
      'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value',
      'total_price',
      'assigned_driver_user_id',
    ],
    include: [
      {
        model: db.User,
        as: 'user',
        required: false,
        attributes: ['id', 'name', 'first_name', 'last_name', 'profile']
      },
      {
        model: db.Package,
        as: 'package',
        required: false,
        attributes: [
          'id',
          'name',
          'base_price',
          'duration_minutes',
          'provider_compensation_type',
          'provider_compensation_value',
          'on_demand_provider_compensation_type',
          'on_demand_provider_compensation_value',
        ],
      },
    ]
  });
  
  if (!booking) return { skipped: true, reason: 'not_found' };

  const plain = booking.get({ plain: true });
  if (String(plain.status || '').trim() !== 'confirmed') {
    logger.info('BOOKING_CREATED skip — not confirmed', { bookingId: id, status: plain.status });
    return { skipped: true, reason: 'not_confirmed' };
  }
  if (plain.assigned_driver_user_id) {
    logger.info('BOOKING_CREATED skip — already assigned', {
      bookingId: id,
      driverUserId: plain.assigned_driver_user_id,
    });
    return { skipped: true, reason: 'already_assigned' };
  }

  const coords = bookingCoords(plain);
  if (!coords) {
    logger.info('BOOKING_CREATED skip — no coordinates', { bookingId: id });
    return { skipped: true, reason: 'no_coordinates' };
  }

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

  // On-demand/asap bookings target the 0-10 mile zone first, then fall back to 50.
  // Scheduled bookings always use the full 50-mile radius.
  const scheduleType = String(plain.schedule_type || '').trim().toLowerCase();
  const isOnDemandType = scheduleType === 'on_demand' || scheduleType === 'asap';

  let driverIds;
  let dispatchRadiusMiles;
  if (isOnDemandType) {
    const result = await findDriversForOnDemandDispatch(coords.lat, coords.lng);
    driverIds = result.driverIds;
    dispatchRadiusMiles = result.radiusMiles;
    logger.info('BOOKING_CREATED on_demand dispatch zone', {
      bookingId: id,
      scheduleType,
      radiusMiles: dispatchRadiusMiles,
      driversFound: driverIds.length,
    });
  } else {
    driverIds = await findNearbyApprovedDriverUserIds(coords.lat, coords.lng);
    dispatchRadiusMiles = 50;
  }

  const eligibleDriverIds = await filterDriversNotRejectedForBooking({ bookingId: id, driverUserIds: driverIds });

  // Always broadcast via the global room so every connected driver sees it,
  // regardless of whether their stored location is within radius.
  emitNewBookingToAllDrivers(payload);

  // Also target individual rooms for drivers whose location IS known nearby
  // (ensures they get it even if the global room broadcast races with their join).
  if (eligibleDriverIds.length > 0) {
    await emitNewBookingAvailableToDrivers(eligibleDriverIds, payload);
  }

  // Push notification: send to nearby drivers if available, otherwise fan-out to
  // ALL approved drivers so the booking is never invisible in background/closed state.
  let pushTargets = eligibleDriverIds;
  if (!pushTargets.length) {
    logger.info('BOOKING_CREATED no nearby drivers — pushing to all approved', { bookingId: id });
    try {
      const allApproved = await db.User.findAll({
        where: { role: 'driver' },
        attributes: ['id'],
        include: [{
          model: db.DriverProfile,
          as: 'driver_profile',
          required: true,
          attributes: [],
          where: { approval_status: 'approved' }
        }],
        limit: 500
      });
      pushTargets = allApproved.map((u) => Number(u.id)).filter((n) => n > 0);
      const rejected = await filterDriversNotRejectedForBooking({ bookingId: id, driverUserIds: pushTargets });
      pushTargets = rejected;
    } catch (err) {
      logger.error('BOOKING_CREATED all-drivers fallback lookup failed', { bookingId: id, message: err?.message });
    }
  }

  await addNewBookingAlertJobs({
    bookingId: id,
    driverUserIds: pushTargets,
    bookingSummary: payload
  });

  return { ok: true, drivers: eligibleDriverIds.length, push_targets: pushTargets.length, dispatch_radius_miles: dispatchRadiusMiles };
}

module.exports = {
  notifyNearbyDriversBookingCreated,
  buildSocketPayload,
  buildCustomerPayload
};
