'use strict';

/**
 * After provider accept on a scheduled booking, customer + provider each get reminders
 * at these offsets before the appointment (minutes): 24h, 12h, 5h, 2h, 1h.
 */
const SCHEDULED_REMINDER_OFFSETS_MIN = [1440, 720, 300, 120, 60];

/** Customer $25 fee if cancelling within 2 hours of scheduled service (inclusive at 2h mark). */
const SCHEDULED_CANCEL_FEE_WINDOW_MINUTES = 120;

/** No-show / en-route cancel fee when provider is ~15 minutes from pickup. */
const EN_ROUTE_FEE_ETA_MINUTES = 15;

/** Assumed urban driving speed for ETA from straight-line distance (~30 mph). */
const EN_ROUTE_ETA_SPEED_M_PER_MIN = 804;

module.exports = {
  SCHEDULED_REMINDER_OFFSETS_MIN,
  SCHEDULED_CANCEL_FEE_WINDOW_MINUTES,
  EN_ROUTE_FEE_ETA_MINUTES,
  EN_ROUTE_ETA_SPEED_M_PER_MIN,
};
