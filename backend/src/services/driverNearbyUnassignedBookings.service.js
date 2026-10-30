const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { getRatingSummariesByUserIds } = require('./review.service');
const { isDriverRejectedForBookings } = require('../modules/bookings/bookingRejectionCache.service');
const { buildDriverJobMapSummary } = require('../utils/driverJobMapSummary');
const { resolveComboServicePackageRow } = require('./bookingPriceSummary.service');

const MAX_RADIUS_MILES = 50;

function normalizeProfile(profile) {
  if (!profile) return null;
  if (typeof profile === 'object') return profile;
  if (typeof profile === 'string') {
    const s = profile.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        const unwrapped = JSON.parse(s);
        if (typeof unwrapped === 'string' && unwrapped.trim()) return { avatar_url: unwrapped.trim() };
        if (unwrapped && typeof unwrapped === 'object') return unwrapped;
      } catch (_e) {
        // fall through
      }
    }
    if (s && !s.startsWith('{') && !s.startsWith('[')) return { avatar_url: s };
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function getProfileImageFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const candidate =
    profile.avatar_url ??
    profile.profile_image ??
    profile.profileImage ??
    profile.image_url ??
    profile.image ??
    profile.picture ??
    profile.photo_url ??
    profile.photo ??
    null;
  return candidate ? String(candidate) : null;
}

function parsePageLimit(query) {
  const page = Number.parseInt(String(query?.page || '1'), 10);
  const limit = Number.parseInt(String(query?.limit || '10'), 10);

  if (!Number.isFinite(page) || page < 1) throw new HttpError(400, 'page must be >= 1');
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'limit must be 1-100');

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Great-circle distance in miles (MySQL expression). driverLat/driverLng must be validated finite numbers.
 */
function sqlDistanceMiles(driverLat, driverLng) {
  const slat = 'COALESCE(`Booking`.`service_lat`, `Booking`.`service_latitude`, `Booking`.`latitude`)';
  const slng = 'COALESCE(`Booking`.`service_lng`, `Booking`.`service_longitude`, `Booking`.`longitude`)';
  return `(3958.7613 * ACOS(LEAST(1, GREATEST(-1,
    COS(RADIANS(${driverLat})) * COS(RADIANS(${slat})) * COS(RADIANS(${slng}) - RADIANS(${driverLng})) +
    SIN(RADIANS(${driverLat})) * SIN(RADIANS(${slat}))
  ))))`;
}

async function listNearbyUnassignedBookings({ auth, query }) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');
  if (driverProfile.approval_status && driverProfile.approval_status !== 'approved') {
    throw new HttpError(403, 'Service provider not approved');
  }

  const driver = await db.User.findByPk(userId, { attributes: ['id', 'latitude', 'longitude'] });
  if (!driver) throw new HttpError(404, 'User not found');

  // Priority: fresh coordinates from the app query param > stored user coordinates.
  // If neither is available we still return all confirmed unassigned bookings so the
  // provider always sees the job board (just without distance filtering).
  const qLat = query?.latitude === undefined || query?.latitude === null || query?.latitude === ''
    ? null : Number(query.latitude);
  const qLng = query?.longitude === undefined || query?.longitude === null || query?.longitude === ''
    ? null : Number(query.longitude);

  const storedLat = driver.latitude === null || driver.latitude === undefined ? null : Number(driver.latitude);
  const storedLng = driver.longitude === null || driver.longitude === undefined ? null : Number(driver.longitude);

  const dLat = (qLat !== null && Number.isFinite(qLat) && qLat >= -90 && qLat <= 90) ? qLat
    : (storedLat !== null && Number.isFinite(storedLat) && storedLat >= -90 && storedLat <= 90) ? storedLat
    : null;
  const dLng = (qLng !== null && Number.isFinite(qLng) && qLng >= -180 && qLng <= 180) ? qLng
    : (storedLng !== null && Number.isFinite(storedLng) && storedLng >= -180 && storedLng <= 180) ? storedLng
    : null;

  const hasDriverLocation = dLat !== null && dLng !== null;

  const { page, limit, offset } = parsePageLimit(query || {});

  // ALL confirmed unassigned bookings are returned regardless of distance.
  // Bookings within 50 miles can be self-accepted by the provider.
  // Bookings beyond 50 miles are returned with requires_admin_assignment=true
  // so the app can inform the provider they need admin assignment.
  // When driver location is known, results are sorted nearest-first;
  // the distance_miles field is included so the app can display it.
  const baseWhere = {
    assigned_driver_user_id: { [Op.is]: null },
    status: 'confirmed'
  };

  const dist = hasDriverLocation ? sqlDistanceMiles(dLat, dLng) : null;

  const { rows, count } = await db.Booking.findAndCountAll({
    where: baseWhere,
    attributes: [
      'id',
      'booking_code',
      'status',
      'service_type',
      'package_id',
      'schedule_type',
      'scheduled_at',
      'created_at',
      'total_price',
      'base_price',
      'custom_package_name',
      'service_datetime',
      'service_duration_minutes',
      'user_id',
      'service_address',
      'service_latitude',
      'service_longitude',
      'service_location_name',
      'latitude',
      'longitude',
      'service_lat',
      'service_lng',
      'charging_latitude',
      'charging_longitude',
      'provider_compensation_amount',
      'on_demand_provider_compensation_amount',
      'provider_compensation_type',
      'provider_compensation_value',
      'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value',
      'base_price',
      ...(dist ? [[db.sequelize.literal(dist), 'distance_miles']] : [])
    ],
    include: [
      { model: db.User, as: 'user', required: false, attributes: ['id', 'name', 'profile', 'latitude', 'longitude'] },
      {
        model: db.Package,
        as: 'package',
        required: false,
        attributes: [
          'id',
          'name',
          'duration_minutes',
          'provider_compensation_type',
          'provider_compensation_value',
          'on_demand_provider_compensation_type',
          'on_demand_provider_compensation_value',
        ],
      },
    ],
    distinct: true,
    // Nearest bookings first when driver location is known, then by newest.
    order: dist
      ? [[db.sequelize.literal(dist), 'ASC'], ['created_at', 'DESC'], ['id', 'DESC']]
      : [['created_at', 'DESC'], ['id', 'DESC']],
    limit,
    offset
  });

  const plainBookings = rows.map((r) => r.get({ plain: true }));
  const hasComboBookings = plainBookings.some(
    (b) => String(b.service_type || '').trim() === 'combo'
  );
  const comboPackageRow = hasComboBookings
    ? await resolveComboServicePackageRow({})
    : null;
  const rejectedMap = await isDriverRejectedForBookings({
    bookingIds: plainBookings.map((b) => b.id),
    driverUserId: userId
  });
  const visibleBookings = plainBookings.filter((b) => !rejectedMap.get(Number(b.id)));
  const customerIds = [...new Set(visibleBookings.map((b) => b.user_id).filter((id) => id != null).map(Number))];
  const ratingMap = await getRatingSummariesByUserIds({ userIds: customerIds });

  const bookings = visibleBookings.map((b) => {
    const slat = b.service_lat ?? b.service_latitude ?? b.latitude;
    const slng = b.service_lng ?? b.service_longitude ?? b.longitude;
    const dm = b.distance_miles === null || b.distance_miles === undefined ? null : Number(b.distance_miles);

    const counterpart = b.user || null;
    const rating = counterpart?.id ? ratingMap.get(Number(counterpart.id)) : null;

    const profile = normalizeProfile(counterpart?.profile);
    const customerImage = getProfileImageFromProfile(profile);
    const customerLat = counterpart?.latitude === null || counterpart?.latitude === undefined ? null : Number(counterpart.latitude);
    const customerLng = counterpart?.longitude === null || counterpart?.longitude === undefined ? null : Number(counterpart.longitude);

    const jobMap = buildDriverJobMapSummary(b, b.package, null, comboPackageRow);

    return {
      id: b.id,
      booking_code: b.booking_code,
      status: b.status,
      service_type: b.service_type,
      schedule_type: b.schedule_type ?? undefined,
      scheduled_at: b.scheduled_at ?? undefined,
      service_datetime: b.service_datetime ?? b.scheduled_at ?? undefined,
      created_at: b.created_at,
      distance_miles: dm === null || !Number.isFinite(dm) ? null : Number(dm.toFixed(2)),
      // true when the booking is beyond the 50-mile self-accept radius
      requires_admin_assignment: dm !== null && Number.isFinite(dm) && dm > MAX_RADIUS_MILES,
      package_id: jobMap.package_id,
      package_name: jobMap.package_name,
      service_duration_minutes: jobMap.service_duration_minutes,
      estimated_travel_minutes: jobMap.estimated_travel_minutes,
      estimated_completion_minutes: jobMap.estimated_completion_minutes,
      provider_earning: jobMap.provider_earning,
      provider_earning_display: jobMap.provider_earning_display,
      pickup_location: jobMap.pickup_location,
      service_location: {
        address: b.service_address ?? null,
        name: b.service_location_name ?? null,
        latitude: slat === null || slat === undefined ? null : Number(slat),
        longitude: slng === null || slng === undefined ? null : Number(slng)
      },
      customer: counterpart
        ? {
            id: counterpart.id,
            name: counterpart.name,
            profile_image: customerImage,
            location: {
              latitude: Number.isFinite(customerLat) ? customerLat : null,
              longitude: Number.isFinite(customerLng) ? customerLng : null
            },
            avg_rating: rating?.avg_rating ?? 4.8,
            review_count: rating?.review_count ?? 0
          }
        : null
    };
  });

  const total = typeof count === 'number' ? count : Number(count || 0);
  const totalPages = total ? Math.ceil(total / limit) : 0;

  return {
    bookings,
    radius_miles: MAX_RADIUS_MILES,
    driver_location: hasDriverLocation ? { latitude: dLat, longitude: dLng } : null,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
}

module.exports = { listNearbyUnassignedBookings, MAX_RADIUS_MILES };
