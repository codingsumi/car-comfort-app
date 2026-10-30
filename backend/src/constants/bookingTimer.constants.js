'use strict';

/** On-demand: minutes after accept to start driving to pick-up before the job returns to the board. */
const ON_DEMAND_ACCEPT_WINDOW_MINUTES = 15;

/** Minutes provider waits at pickup (contacting customer) before no-show may be recorded. */
const ARRIVAL_WAIT_WINDOW_MINUTES = 15;

/** Scheduled: minutes before service start when provider must head to pickup (countdown 60→0). */
const SCHEDULED_PICKUP_WINDOW_MINUTES = 60;

/** Max service duration tracked per job (hours). Timer stops on service completed. */
const SERVICE_TIMER_MAX_HOURS = 3;
const SERVICE_TIMER_MAX_MINUTES = SERVICE_TIMER_MAX_HOURS * 60;

/** Countdown push/socket ticks (minutes remaining) for 15-minute windows. */
const TIMER_COUNTDOWN_MINUTES = [15, 10, 5, 3, 2, 1];

/** Scheduled pickup window ticks (60 minutes → 0). */
const SCHEDULED_PICKUP_COUNTDOWN_MINUTES = [60, 45, 30, 15, 10, 5, 3, 2, 1];

/** Service duration ticks (up to 3 hours). */
const SERVICE_DURATION_COUNTDOWN_MINUTES = [180, 120, 60, 30, 15, 5, 1];

const ON_DEMAND_ACCEPT_WINDOW_MS = ON_DEMAND_ACCEPT_WINDOW_MINUTES * 60 * 1000;
const ARRIVAL_WAIT_WINDOW_MS = ARRIVAL_WAIT_WINDOW_MINUTES * 60 * 1000;
const SCHEDULED_PICKUP_WINDOW_MS = SCHEDULED_PICKUP_WINDOW_MINUTES * 60 * 1000;
const SERVICE_TIMER_MAX_MS = SERVICE_TIMER_MAX_MINUTES * 60 * 1000;

/** Tracking statuses that mean the driver has started toward pickup. */
const DRIVER_MOVEMENT_TRACKING_STATUSES = new Set([
  'DRIVER_STARTED_TO_CUSTOMER',
  'DRIVER_NEAR_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER',
  'OTP_PENDING',
  'OTP_VERIFIED',
  'VEHICLE_PICKED',
  'DRIVER_STARTED_TO_SERVICE_CENTER',
  'DRIVER_REACHED_SERVICE_CENTER',
  'SERVICE_STARTED',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'FIRST_SERVICE_COMPLETED',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
  'DRIVER_REACHED_NEXT_SERVICE_STOP',
  'SECOND_SERVICE_STARTED',
  'SECOND_SERVICE_IN_PROGRESS',
  'SECOND_SERVICE_COMPLETED',
  'BEFORE_IMAGES_UPLOADED',
  'AFTER_IMAGES_UPLOADED',
  'DRIVER_LEFT_SERVICE_CENTER',
  'DRIVER_RETURNING_TO_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER_RETURN',
  'VEHICLE_DELIVERED',
]);

const BOOKING_TIMER_PHASES = {
  ACCEPT_COUNTDOWN: 'accept_countdown',
  ACCEPT_TIMEOUT: 'accept_timeout',
  ARRIVAL_COUNTDOWN: 'arrival_countdown',
  ARRIVAL_EXPIRED: 'arrival_expired',
  SCHEDULED_PICKUP_COUNTDOWN: 'scheduled_pickup_countdown',
  SCHEDULED_PICKUP_TIMEOUT: 'scheduled_pickup_timeout',
  SERVICE_COUNTDOWN: 'service_countdown',
  SERVICE_MAX_REACHED: 'service_max_reached',
};

const ARRIVAL_TRACKING_RANK = 30; // DRIVER_REACHED_CUSTOMER

function hasDriverArrivedAtPickup(trackingStatus) {
  const { resolveTrackingStatusRank } = require('../modules/bookings/trackingStatuses');
  const rank = resolveTrackingStatusRank(trackingStatus);
  return rank >= ARRIVAL_TRACKING_RANK;
}

module.exports = {
  ON_DEMAND_ACCEPT_WINDOW_MINUTES,
  ARRIVAL_WAIT_WINDOW_MINUTES,
  SCHEDULED_PICKUP_WINDOW_MINUTES,
  SERVICE_TIMER_MAX_HOURS,
  SERVICE_TIMER_MAX_MINUTES,
  TIMER_COUNTDOWN_MINUTES,
  SCHEDULED_PICKUP_COUNTDOWN_MINUTES,
  SERVICE_DURATION_COUNTDOWN_MINUTES,
  ON_DEMAND_ACCEPT_WINDOW_MS,
  ARRIVAL_WAIT_WINDOW_MS,
  SCHEDULED_PICKUP_WINDOW_MS,
  SERVICE_TIMER_MAX_MS,
  DRIVER_MOVEMENT_TRACKING_STATUSES,
  BOOKING_TIMER_PHASES,
  ARRIVAL_TRACKING_RANK,
  hasDriverArrivedAtPickup,
};
