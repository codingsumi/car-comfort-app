'use strict';

/** Platform local timezone for schedule/on-demand rules (matches default app setting). */
const DEFAULT_PLATFORM_TIMEZONE = process.env.PLATFORM_TIMEZONE || 'America/New_York';

/** Confirmed ≥ this far before service start → scheduled (no on-demand fee). */
const SCHEDULED_MIN_ADVANCE_MS = 24 * 60 * 60 * 1000;

function normalizeScheduleType(scheduleType) {
  return String(scheduleType || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

/**
 * Calendar date in [timeZone] as YYYY-MM-DD (for same-day comparisons).
 */
function toCalendarDateKey(date, timeZone = DEFAULT_PLATFORM_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

/**
 * Resolves whether a booking is treated as scheduled or on-demand for pricing/ops.
 *
 * Scheduled (no $50 on-demand fee):
 * - Confirmed at least 24 hours before service start, e.g. Sun 11:59 PM for Mon service.
 *
 * On-demand (+$50 fee when applicable):
 * - Explicit on_demand / asap type, or
 * - Confirmed on the same local calendar day as the service and under 24 hours before start,
 *   e.g. Mon 12:00 AM for Mon service.
 */
function resolveEffectiveScheduleType(
  scheduleType,
  serviceAt,
  confirmedAt = new Date(),
  timeZone = DEFAULT_PLATFORM_TIMEZONE
) {
  const normalized = normalizeScheduleType(scheduleType);
  if (normalized === 'on_demand' || normalized === 'asap') return 'on_demand';
  if (normalized !== 'scheduled') return normalized;

  const svcMs = serviceAt ? new Date(serviceAt).getTime() : NaN;
  const confirmMs = new Date(confirmedAt).getTime();
  if (!Number.isFinite(svcMs) || !Number.isFinite(confirmMs) || svcMs <= confirmMs) {
    return 'scheduled';
  }

  const msUntilService = svcMs - confirmMs;
  if (msUntilService >= SCHEDULED_MIN_ADVANCE_MS) {
    return 'scheduled';
  }

  const confirmDay = toCalendarDateKey(confirmedAt, timeZone);
  const serviceDay = toCalendarDateKey(serviceAt, timeZone);
  if (confirmDay === serviceDay) {
    return 'on_demand';
  }

  return 'scheduled';
}

function isOnDemandEffectiveScheduleType(scheduleType) {
  const t = normalizeScheduleType(scheduleType);
  return t === 'on_demand' || t === 'asap';
}

module.exports = {
  DEFAULT_PLATFORM_TIMEZONE,
  SCHEDULED_MIN_ADVANCE_MS,
  normalizeScheduleType,
  toCalendarDateKey,
  resolveEffectiveScheduleType,
  isOnDemandEffectiveScheduleType,
};
