import { format, isValid } from 'date-fns';

/** Rows that may expose Sequelize timestamps as snake_case or camelCase. */
export type TimestampSource =
  | {
      created_at?: string | null;
      createdAt?: string | Date | null;
      updated_at?: string | null;
      updatedAt?: string | Date | null;
    }
  | null
  | undefined;

function toIsoString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Read created_at or Sequelize's createdAt from API / table rows. */
export function pickTimestamp(row: TimestampSource, field: 'created' | 'updated' = 'created'): string | undefined {
  if (!row) return undefined;
  const snake = field === 'created' ? row.created_at : row.updated_at;
  const camel = field === 'created' ? row.createdAt : row.updatedAt;
  return toIsoString(snake ?? camel);
}

export function formatDate(value: string | null | undefined, pattern = 'MMM d, yyyy') {
  if (!value) return '—';
  const d = new Date(value);
  return isValid(d) ? format(d, pattern) : '—';
}

const APP_TIMEZONE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_TIMEZONE) ||
  'America/New_York';

/** Date + time with timezone abbreviation (for service records, invoices). */
export function formatDateTimeTz(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (!isValid(d)) return '—';
  // Note: dateStyle/timeStyle cannot be mixed with timeZoneName (Intl spec).
  // Use explicit component options instead.
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
    timeZoneName: 'short',
  }).format(d);
}

export function formatDurationMinutes(minutes: number | null | undefined) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m === 0) return '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function formatJoinedDate(row: TimestampSource, pattern = 'MMM d, yyyy') {
  return formatDate(pickTimestamp(row, 'created'), pattern);
}
