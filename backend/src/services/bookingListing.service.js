const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { getRatingSummariesByUserIds, formatPublicAvgRating } = require('./review.service');
const {
  resolveBookingChargedTotal,
  formatUsdAmount,
} = require('./bookingPriceSummary.service');
const { buildDriverJobMapSummary, resolveEstimatedTravelMiles } = require('../utils/driverJobMapSummary');
const { getEvBatteryStatusLabel } = require('../constants/evChargingBooking');

const ROLES = new Set(['customer', 'driver', 'admin']);
const STATUSES = new Set(['all', 'pending', 'pending_payment', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled']);
const PENDING_LIST_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress'];

function normalizeProfile(profile) {
  if (!profile) return null;
  if (typeof profile === 'object') return profile;
  if (typeof profile === 'string') {
    const s = profile.trim();
    // Some DBs store a JSON string literal like "\"https://...\"" (double-quoted URL).
    // Parse it first so we can return a clean URL.
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        const unwrapped = JSON.parse(s);
        if (typeof unwrapped === 'string' && unwrapped.trim()) return { avatar_url: unwrapped.trim() };
        if (unwrapped && typeof unwrapped === 'object') return unwrapped;
      } catch (_e) {
        // fall through
      }
    }
    // Some DBs store a direct URL/string in `users.profile`.
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

function buildWhere({ auth, query }) {
  const where = { status: { [Op.ne]: 'draft' } };

  const role = String(auth?.role || '').trim();
  const userId = auth?.userId ? Number(auth.userId) : null;

  if (!ROLES.has(role) || !userId) throw new HttpError(401, 'Unauthorized');

  if (role === 'customer') where.user_id = { [Op.eq]: userId };
  if (role === 'driver') where.assigned_driver_user_id = { [Op.eq]: userId };

  const status = query?.status ? String(query.status).trim().toLowerCase() : null;
  if (status && status !== 'all') {
    if (!STATUSES.has(status)) throw new HttpError(400, 'Invalid status');
    where.status = status === 'pending' ? { [Op.in]: PENDING_LIST_STATUSES } : status;
  }

  return where;
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineMiles({ lat1, lng1, lat2, lng2 }) {
  const a1 = toNumberOrNull(lat1);
  const o1 = toNumberOrNull(lng1);
  const a2 = toNumberOrNull(lat2);
  const o2 = toNumberOrNull(lng2);
  if (a1 === null || o1 === null || a2 === null || o2 === null) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const Rm = 3958.7613; // earth radius in miles
  const dLat = toRad(a2 - a1);
  const dLng = toRad(o2 - o1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const q = s1 * s1 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  return Rm * c;
}

async function listBookings({ auth, query }) {
  const { page, limit, offset } = parsePageLimit(query || {});
  const where = buildWhere({ auth, query: query || {} });

  const { rows, count } = await db.Booking.findAndCountAll({
    where,
    attributes: [
      'id',
      'booking_code',
      'status',
      'service_type',
      'package_id',
      'custom_package_name',
      'vehicle_charge_limit',
      'current_battery_charge',
      'current_battery_status',
      'schedule_type',
      'scheduled_at',
      'created_at',
      'total_price',
      'price_summary',
      'user_id',
      'assigned_driver_user_id',
      'cancelled_by',
      'cancellation_reason',
      'latitude',
      'longitude',
      'charging_latitude',
      'charging_longitude',
      'service_address',
      'service_latitude',
      'service_longitude',
      'service_location_name',
      'tracking_status',
      'driver_accepted_at',
      'on_demand_accept_deadline_at',
      'driver_arrived_customer_at',
      'arrival_wait_expires_at',
      'scheduled_pickup_window_start_at',
      'scheduled_pickup_deadline_at',
      'service_started_at',
      'service_timer_expires_at',
      'service_completed_at',
      'service_duration_minutes',
    ],
    include: [
      {
        model: db.User,
        as: 'assigned_driver',
        required: false,
        attributes: ['id', 'name'],
        include: [{ model: db.DriverProfile, as: 'driver_profile', required: false, attributes: ['profile_picture'] }]
      },
      { model: db.User, as: 'user', required: false, attributes: ['id', 'name', 'profile', 'latitude', 'longitude'] },
      {
        model: db.Package,
        as: 'package',
        required: false,
        attributes: ['id', 'name', 'duration_minutes'],
        include: [{ model: db.Service, as: 'service', required: false, attributes: ['id', 'name'] }],
      },
    ],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit,
    offset
  });

  const plainBookings = rows.map((r) => r.get({ plain: true }));

  const bookingIds = plainBookings.map((b) => b.id);
  const succeededTxns = bookingIds.length
    ? await db.BookingTransaction.findAll({
        where: { booking_id: { [Op.in]: bookingIds }, status: 'succeeded' },
        attributes: ['booking_id', 'amount'],
        order: [['created_at', 'DESC']],
      })
    : [];
  const txnAmountByBookingId = new Map();
  for (const txn of succeededTxns) {
    const bookingId = Number(txn.booking_id);
    if (!txnAmountByBookingId.has(bookingId)) {
      txnAmountByBookingId.set(bookingId, Number(txn.amount));
    }
  }

  const role = String(auth?.role || '').trim();
  const counterpartIds = new Set();
  for (const b of plainBookings) {
    if (role === 'customer' && b.assigned_driver_user_id) counterpartIds.add(Number(b.assigned_driver_user_id));
    if (role === 'driver' && b.user_id) counterpartIds.add(Number(b.user_id));
  }
  const ratingMap = await getRatingSummariesByUserIds({ userIds: Array.from(counterpartIds) });

  const distanceMilesList = await Promise.all(
    plainBookings.map(async (b) => {
      try {
        const miles = await resolveEstimatedTravelMiles(b, b.package);
        if (miles != null && Number.isFinite(miles) && miles > 0) return miles;
      } catch (_err) {
        // Fall back to straight-line round-trip estimate below.
      }
      return buildDriverJobMapSummary(b).estimated_travel_miles;
    })
  );

  const bookings = plainBookings.map((b, idx) => {
    const total_price = resolveBookingChargedTotal(b, {
      transactionAmount: txnAmountByBookingId.get(Number(b.id)),
    });
    const total_price_display = formatUsdAmount(total_price);

    const counterpart =
      role === 'customer'
        ? b.assigned_driver
        : role === 'driver'
          ? b.user
          : b.assigned_driver || b.user || null;

    const rating = counterpart?.id ? ratingMap.get(Number(counterpart.id)) : null;

    // Round-trip driving distance: pickup → service stop(s) → pickup.
    const distance_miles = distanceMilesList[idx];
    const jobMap = buildDriverJobMapSummary(b, b.package);

    const out = {
      id: b.id,
      booking_code: b.booking_code,
      status: b.status,
      cancelled_by: b.cancelled_by ?? null,
      cancellation_reason: b.cancellation_reason ?? null,
      service_type: b.service_type,
      package_id: b.package_id ?? jobMap.package_id ?? null,
      package_name: jobMap.package_name ?? null,
      custom_package_name: b.custom_package_name ?? null,
      vehicle_charge_limit: b.vehicle_charge_limit ?? null,
      current_battery_charge: b.current_battery_charge ?? null,
      current_battery_status: b.current_battery_status ?? null,
      current_battery_status_label:
        (b.current_battery_status != null && b.current_battery_status !== ''
          ? getEvBatteryStatusLabel(b.current_battery_status)
          : null) ||
        (b.current_battery_charge != null && b.current_battery_charge !== ''
          ? getEvBatteryStatusLabel(String(b.current_battery_charge)) ||
            `${String(b.current_battery_charge).trim()}%`
          : null),
      schedule_type: b.schedule_type ?? undefined,
      scheduled_at: b.scheduled_at ?? undefined,
      created_at: b.created_at,
      ...(role === 'driver'
        ? {}
        : {
            total_price,
            currency: 'usd',
            total_price_display,
          }),
      distance_miles: distance_miles === null ? null : Number(distance_miles),
      service_duration_minutes: jobMap.service_duration_minutes ?? null,
      service_location: {
        address: b.service_address ?? null,
        name: b.service_location_name ?? null,
        latitude: b.service_latitude === null || b.service_latitude === undefined ? null : Number(b.service_latitude),
        longitude: b.service_longitude === null || b.service_longitude === undefined ? null : Number(b.service_longitude)
      }
    };

    if (role === 'customer') {
      out.driver_id = b.assigned_driver_user_id || null;
      out.driver_detail = counterpart
        ? {
            id: counterpart.id,
            name: counterpart.name,
            profile_picture: counterpart.driver_profile?.profile_picture || null,
            avg_rating: formatPublicAvgRating(rating),
            review_count: Number(rating?.review_count || 0)
          }
        : null;
    } else if (role === 'driver') {
      const profile = normalizeProfile(counterpart?.profile);
      const customerImage = getProfileImageFromProfile(profile);
      const customerLat =
        counterpart?.latitude === null || counterpart?.latitude === undefined ? null : Number(counterpart.latitude);
      const customerLng =
        counterpart?.longitude === null || counterpart?.longitude === undefined ? null : Number(counterpart.longitude);

      out.customer = counterpart
        ? {
            id: counterpart.id,
            name: counterpart.name,
            profile: customerImage,
            location: {
              latitude: Number.isFinite(customerLat) ? customerLat : null,
              longitude: Number.isFinite(customerLng) ? customerLng : null
            },
            avg_rating: formatPublicAvgRating(rating),
            review_count: Number(rating?.review_count || 0)
          }
        : null;

      out.timers = {
        tracking_status: b.tracking_status ?? null,
        driver_accepted_at: b.driver_accepted_at ?? null,
        on_demand_accept_deadline_at: b.on_demand_accept_deadline_at ?? null,
        driver_arrived_customer_at: b.driver_arrived_customer_at ?? null,
        arrival_wait_expires_at: b.arrival_wait_expires_at ?? null,
        scheduled_pickup_window_start_at: b.scheduled_pickup_window_start_at ?? null,
        scheduled_pickup_deadline_at: b.scheduled_pickup_deadline_at ?? null,
        service_started_at: b.service_started_at ?? null,
        service_timer_expires_at: b.service_timer_expires_at ?? null,
        service_completed_at: b.service_completed_at ?? null,
        service_duration_minutes:
          b.service_duration_minutes != null ? Number(b.service_duration_minutes) : null,
      };
      // Drivers receive only their own payout, never the customer charge.
      out.provider_earning = jobMap.provider_earning;
      out.provider_earning_display = jobMap.provider_earning_display;
    }

    return out;
  });
  const total = typeof count === 'number' ? count : Number(count || 0);
  const totalPages = total ? Math.ceil(total / limit) : 0;

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
}

module.exports = { listBookings };
