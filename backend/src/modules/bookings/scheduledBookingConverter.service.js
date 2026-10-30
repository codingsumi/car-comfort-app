'use strict';

/**
 * scheduledBookingConverter.service.js
 *
 * Converts overdue scheduled bookings to on-demand and re-dispatches them.
 *
 * A scheduled booking is considered "overdue" when:
 *  - schedule_type = 'scheduled'
 *  - status = 'confirmed' (unaccepted — still on the job board)
 *  - assigned_driver_user_id IS NULL
 *  - The service day (scheduled_at or service_datetime) has passed
 *    (i.e. it is now past midnight local time on the service day)
 *
 * On conversion:
 *  1. schedule_type is updated to 'on_demand'
 *  2. The booking stays confirmed + unassigned (stays on the job board)
 *  3. On-demand dispatch is triggered to notify 0-10 mile providers
 */

const { Op } = require('sequelize');
const db = require('../../models');
const { logger } = require('../../config/logger');
const { DEFAULT_PLATFORM_TIMEZONE } = require('../../utils/bookingSchedulePolicy');
const { notifyNearbyDriversBookingCreated } = require('./bookingCreatedNotify.service');

/**
 * Returns the start of today in UTC based on the platform timezone.
 * e.g. if platform is America/New_York (UTC-4) and it is 2026-07-14 01:00 UTC,
 * today in NY is 2026-07-13, so startOfTodayUtc = 2026-07-13T04:00:00Z.
 */
function startOfServiceDayUtc(timeZone) {
  try {
    const nowLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    // nowLocal = 'YYYY-MM-DD'. Parse as UTC midnight, then offset back.
    return new Date(`${nowLocal}T00:00:00Z`);
  } catch {
    // Fallback: UTC midnight
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}

/**
 * Find and convert all overdue scheduled bookings to on-demand.
 * Returns a summary of how many were converted.
 */
async function convertOverdueScheduledBookings() {
  const startOfToday = startOfServiceDayUtc(DEFAULT_PLATFORM_TIMEZONE);

  // Find all overdue scheduled bookings
  const overdueBookings = await db.Booking.findAll({
    where: {
      schedule_type: 'scheduled',
      status: 'confirmed',
      assigned_driver_user_id: { [Op.is]: null },
      [Op.or]: [
        { scheduled_at: { [Op.lt]: startOfToday } },
        { service_datetime: { [Op.lt]: startOfToday } },
      ],
    },
    attributes: ['id', 'booking_code', 'schedule_type', 'status', 'scheduled_at', 'service_datetime'],
    limit: 200, // Safety cap per run
  });

  if (!overdueBookings.length) {
    return { converted: 0, errors: 0 };
  }

  logger.info('scheduled_to_on_demand_conversion_start', {
    count: overdueBookings.length,
    startOfToday,
  });

  let converted = 0;
  let errors = 0;

  for (const booking of overdueBookings) {
    try {
      await booking.update({ schedule_type: 'on_demand' });

      // Trigger on-demand dispatch (socket + push to 0-10 mile providers)
      notifyNearbyDriversBookingCreated(booking.id).catch((err) => {
        logger.warn('scheduled_to_on_demand_dispatch_failed', {
          bookingId: booking.id,
          message: err?.message,
        });
      });

      logger.info('scheduled_to_on_demand_converted', {
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        scheduledAt: booking.scheduled_at,
        serviceDatetime: booking.service_datetime,
      });

      converted += 1;
    } catch (err) {
      errors += 1;
      logger.error('scheduled_to_on_demand_conversion_error', {
        bookingId: booking.id,
        message: err?.message,
        stack: err?.stack,
      });
    }
  }

  logger.info('scheduled_to_on_demand_conversion_complete', { converted, errors });
  return { converted, errors };
}

/**
 * Start a periodic scheduler that checks for overdue scheduled bookings
 * every 15 minutes and converts them to on-demand.
 */
function startScheduledBookingConverterScheduler() {
  const enabled =
    String(process.env.SCHEDULED_BOOKING_CONVERTER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return null;

  const intervalMs = 15 * 60 * 1000; // 15 minutes

  const run = async () => {
    try {
      const result = await convertOverdueScheduledBookings();
      if (result.converted > 0 || result.errors > 0) {
        logger.info('scheduled_booking_converter_run', result);
      }
    } catch (err) {
      logger.error('scheduled_booking_converter_run_failed', {
        message: err?.message,
        stack: err?.stack,
      });
    }
  };

  // Run once on startup to catch any bookings missed during downtime
  run();

  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  logger.info('scheduled_booking_converter_scheduler_started', { intervalMs });
  return timer;
}

module.exports = {
  convertOverdueScheduledBookings,
  startScheduledBookingConverterScheduler,
};
