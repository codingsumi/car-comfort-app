'use strict';

const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { formatPublicAvgRating, getRatingSummariesByUserIds } = require('./review.service');
const { resolveCustomerVehiclePickupOtp } = require('../utils/customerPickupOtp');

const { ARRIVAL_WAIT_WINDOW_MS } = require('../constants/bookingTimer.constants');
const { isScheduledScheduleType } = require('../constants/bookingAfterBookingMessages');

const LIVE_BOOKING_STATUSES = ['assigned', 'in_progress'];
const TERMINAL_TRACKING = new Set(['VEHICLE_DELIVERED', 'BOOKING_CANCELLED']);
const PICKUP_OTP_WAIT_TRACKING = new Set(['DRIVER_REACHED_CUSTOMER', 'OTP_PENDING']);

/**
 * Tracking codes that indicate the provider has actually started driving / servicing.
 * A booking is only "live" for conflict purposes once one of these is set.
 * Values like 'scheduled' or '' are metadata markers, NOT trip-progress codes.
 */
const TRIP_STARTED_TRACKING = new Set([
  'DRIVER_STARTED_TO_CUSTOMER',
  'DRIVER_NEAR_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER',
  'OTP_PENDING',
  'OTP_VERIFIED',
  'BEFORE_IMAGES_UPLOADED',
  'VEHICLE_PICKED',
  'DRIVER_STARTED_TO_SERVICE_CENTER',
  'DRIVER_REACHED_SERVICE_CENTER',
  'VEHICLE_WAITING_IN_QUEUE',
  'SERVICE_LOCATION_ISSUE',
  'SERVICE_STARTED',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'FIRST_SERVICE_COMPLETED',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
  'DRIVER_REACHED_NEXT_SERVICE_STOP',
  'SECOND_SERVICE_STARTED',
  'SECOND_SERVICE_IN_PROGRESS',
  'SECOND_SERVICE_COMPLETED',
  'AFTER_IMAGES_UPLOADED',
  'DRIVER_LEFT_SERVICE_CENTER',
  'DRIVER_RETURNING_TO_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER_RETURN',
  'VEHICLE_DELIVERED',
]);

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * After the arrival-wait window ends, do not auto-resume the customer dashboard trip.
 * Stale test/dev bookings otherwise reopen the OTP sheet on every login.
 */
function isExpiredPickupWaitForDashboardResume(bookingPlain) {
  const tracking = String(bookingPlain.tracking_status || '').trim().toUpperCase();
  if (!PICKUP_OTP_WAIT_TRACKING.has(tracking)) return false;

  let waitEndsAt = parseDate(bookingPlain.arrival_wait_expires_at);
  if (!waitEndsAt) {
    const arrivedAt = parseDate(bookingPlain.driver_arrived_customer_at);
    if (arrivedAt) {
      waitEndsAt = new Date(arrivedAt.getTime() + ARRIVAL_WAIT_WINDOW_MS);
    }
  }
  if (!waitEndsAt) return false;
  return Date.now() > waitEndsAt.getTime();
}

function parseUserId(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  if (!userId) throw new HttpError(401, 'Unauthorized');
  return userId;
}

/**
 * Customer's current live trip (driver assigned, service not finished).
 * Used on dashboard open to re-join booking room + refresh trip UI.
 */
async function getActiveBookingForCustomer({ auth }) {
  const role = String(auth?.role || '').trim();
  if (role !== 'customer') {
    throw new HttpError(403, 'Only customers can use this endpoint');
  }

  const userId = parseUserId(auth);

  const booking = await db.Booking.findOne({
    where: {
      user_id: { [Op.eq]: userId },
      status: { [Op.in]: LIVE_BOOKING_STATUSES },
      assigned_driver_user_id: { [Op.ne]: null }
    },
    attributes: [
      'id',
      'booking_code',
      'status',
      'tracking_status',
      'service_type',
      'assigned_driver_user_id',
      'schedule_type',
      'driver_accepted_at',
      'on_demand_accept_deadline_at',
      'arrival_wait_expires_at',
      'driver_arrived_customer_at',
      'scheduled_pickup_window_start_at',
      'scheduled_pickup_deadline_at',
      'service_started_at',
      'service_timer_expires_at',
      'service_completed_at',
      'service_duration_minutes',
      'pickup_otp',
      'pickup_otp_expiry',
      'updated_at'
    ],
    include: [
      {
        model: db.User,
        as: 'assigned_driver',
        required: false,
        attributes: ['id', 'name', 'phone'],
        include: [
          {
            model: db.DriverProfile,
            as: 'driver_profile',
            required: false,
            attributes: ['profile_picture']
          }
        ]
      }
    ],
    order: [['updated_at', 'DESC']]
  });

  if (!booking) {
    return { booking: null };
  }

  const plain = booking.get({ plain: true });
  const tracking = String(plain.tracking_status || '').trim().toUpperCase();
  if (TERMINAL_TRACKING.has(tracking)) {
    return { booking: null };
  }
  if (plain.service_completed_at) {
    return { booking: null };
  }
  if (isExpiredPickupWaitForDashboardResume(plain)) {
    return { booking: null };
  }

  const driver = plain.assigned_driver;
  let driverDetail = null;
  if (driver?.id) {
    const ratingMap = await getRatingSummariesByUserIds({ userIds: [Number(driver.id)] });
    const rating = ratingMap.get(Number(driver.id));
    driverDetail = {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      profile_picture: driver.driver_profile?.profile_picture || null,
      avg_rating: formatPublicAvgRating(rating),
      review_count: Number(rating?.review_count || 0)
    };
  }

  return {
    booking: {
      id: plain.id,
      booking_code: plain.booking_code,
      status: plain.status,
      tracking_status: plain.tracking_status,
      service_type: plain.service_type,
      driver_id: plain.assigned_driver_user_id,
      driver_detail: driverDetail,
      schedule_type: plain.schedule_type ?? null,
      timers: {
        driver_accepted_at: plain.driver_accepted_at ?? null,
        on_demand_accept_deadline_at: plain.on_demand_accept_deadline_at ?? null,
        driver_arrived_customer_at: plain.driver_arrived_customer_at ?? null,
        arrival_wait_expires_at: plain.arrival_wait_expires_at ?? null,
        scheduled_pickup_window_start_at: plain.scheduled_pickup_window_start_at ?? null,
        scheduled_pickup_deadline_at: plain.scheduled_pickup_deadline_at ?? null,
        service_started_at: plain.service_started_at ?? null,
        service_timer_expires_at: plain.service_timer_expires_at ?? null,
        service_completed_at: plain.service_completed_at ?? null,
        service_duration_minutes:
          plain.service_duration_minutes != null ? Number(plain.service_duration_minutes) : null,
      },
      arrival_wait_expires_at: plain.arrival_wait_expires_at,
      driver_arrived_customer_at: plain.driver_arrived_customer_at,
      vehicle_pickup_otp: await resolveCustomerVehiclePickupOtp(booking),
      updated_at: plain.updated_at
    }
  };
}

function isActiveDriverBookingPlain(plain) {
  if (!plain) return false;
  const tracking = String(plain.tracking_status || '').trim().toUpperCase();
  if (TERMINAL_TRACKING.has(tracking)) return false;
  if (plain.service_completed_at) return false;
  const status = String(plain.status || '').trim().toLowerCase();
  if (status !== 'assigned' && status !== 'in_progress') return false;

  // A scheduled booking that was accepted but not yet started must NOT block
  // the provider from accepting other bookings. "Not started" means the
  // tracking_status is not a real trip-progress code. Values like 'scheduled'
  // (set by bookingV2 when a booking is placed) are metadata markers, not
  // trip-progress codes — TRIP_STARTED_TRACKING is the source of truth.
  const scheduleType = plain.schedule_type ?? plain.scheduleType;
  if (isScheduledScheduleType(scheduleType) && !TRIP_STARTED_TRACKING.has(tracking)) {
    return false;
  }

  return true;
}

/**
 * Provider's current in-flight booking (assigned / in progress, not delivered or cancelled).
 */
async function findActiveBookingForDriver(driverUserId, { excludeBookingId } = {}) {
  const uid = Number(driverUserId);
  if (!uid) return null;

  const where = {
    assigned_driver_user_id: { [Op.eq]: uid },
    status: { [Op.in]: LIVE_BOOKING_STATUSES },
  };
  if (excludeBookingId != null) {
    const excluded = Number(excludeBookingId);
    if (excluded > 0) {
      where.id = { [Op.ne]: excluded };
    }
  }

  const booking = await db.Booking.findOne({
    where,
    attributes: [
      'id',
      'booking_code',
      'status',
      'tracking_status',
      'schedule_type',     // needed to exclude scheduled-but-not-started bookings
      'service_completed_at',
      'updated_at',
    ],
    order: [['updated_at', 'DESC']],
  });

  if (!booking) return null;
  const plain = booking.get({ plain: true });
  return isActiveDriverBookingPlain(plain) ? plain : null;
}

/**
 * Provider's current in-flight booking for dashboard restore after app relaunch.
 */
async function getActiveBookingForDriver({ auth }) {
  const role = String(auth?.role || '').trim();
  if (role !== 'driver') {
    throw new HttpError(403, 'Only service providers can use this endpoint');
  }

  const userId = parseUserId(auth);
  const plain = await findActiveBookingForDriver(userId);
  if (!plain) {
    return { booking: null };
  }

  const booking = await db.Booking.findOne({
    where: { id: plain.id },
    attributes: [
      'id',
      'booking_code',
      'status',
      'tracking_status',
      'service_type',
      'schedule_type',
      'package_id',
      'driver_accepted_at',
      'on_demand_accept_deadline_at',
      'arrival_wait_expires_at',
      'driver_arrived_customer_at',
      'scheduled_pickup_window_start_at',
      'scheduled_pickup_deadline_at',
      'service_started_at',
      'service_timer_expires_at',
      'service_completed_at',
      'service_duration_minutes',
      'updated_at',
    ],
    include: [
      {
        model: db.User,
        as: 'user',
        required: false,
        attributes: ['id', 'name', 'phone'],
      },
    ],
  });

  if (!booking) {
    return { booking: null };
  }

  const row = booking.get({ plain: true });
  if (!isActiveDriverBookingPlain(row)) {
    return { booking: null };
  }

  const customer = row.user;
  return {
    booking: {
      id: row.id,
      booking_code: row.booking_code,
      status: row.status,
      tracking_status: row.tracking_status,
      service_type: row.service_type,
      schedule_type: row.schedule_type ?? null,
      package_id: row.package_id ?? null,
      customer_detail: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            profile_picture: null,
          }
        : null,
      timers: {
        driver_accepted_at: row.driver_accepted_at ?? null,
        on_demand_accept_deadline_at: row.on_demand_accept_deadline_at ?? null,
        driver_arrived_customer_at: row.driver_arrived_customer_at ?? null,
        arrival_wait_expires_at: row.arrival_wait_expires_at ?? null,
        scheduled_pickup_window_start_at: row.scheduled_pickup_window_start_at ?? null,
        scheduled_pickup_deadline_at: row.scheduled_pickup_deadline_at ?? null,
        service_started_at: row.service_started_at ?? null,
        service_timer_expires_at: row.service_timer_expires_at ?? null,
        service_completed_at: row.service_completed_at ?? null,
        service_duration_minutes:
          row.service_duration_minutes != null
            ? Number(row.service_duration_minutes)
            : null,
      },
      updated_at: row.updated_at,
    },
  };
}

module.exports = {
  getActiveBookingForCustomer,
  getActiveBookingForDriver,
  findActiveBookingForDriver,
  isActiveDriverBookingPlain,
  isExpiredPickupWaitForDashboardResume,
};
