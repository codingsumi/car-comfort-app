'use strict';

function resolveAppTimeZone() {
  const tz = String(
    process.env.INVOICE_TIMEZONE || process.env.APP_TIMEZONE || 'America/New_York'
  ).trim();
  return tz || 'America/New_York';
}

function safeDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateTimeInTimeZone(
  value,
  {
    timeZone = resolveAppTimeZone(),
    withTimeZoneName = true,
  } = {}
) {
  const d = safeDate(value);
  if (!d) return '—';

  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  };
  if (withTimeZoneName) options.timeZoneName = 'short';

  return new Intl.DateTimeFormat('en-US', options).format(d);
}

function formatDateInTimeZone(
  value,
  { timeZone = resolveAppTimeZone() } = {}
) {
  const d = safeDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(d);
}

function formatDurationMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m === 0) return '0 minutes';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const hours = Math.floor(m / 60);
  const remainder = m % 60;
  if (remainder === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${remainder} minute${remainder === 1 ? '' : 's'}`;
}

function formatProviderId(providerId) {
  const id = Number(providerId);
  if (!Number.isInteger(id) || id <= 0) return '—';
  return `#${String(id).padStart(5, '0')}`;
}

module.exports = {
  resolveAppTimeZone,
  formatDateTimeInTimeZone,
  formatDateInTimeZone,
  formatDurationMinutes,
  formatProviderId,
};
