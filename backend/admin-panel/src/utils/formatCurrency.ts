/**
 * Format a monetary value as USD with thousands separators.
 * e.g.  12345.6  →  $12,345.60
 *       1234567  →  $1,234,567.00
 *       null     →  —
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Compact format for stats cards: abbreviates large numbers.
 * e.g.  1500000  →  $1.5M
 *       12500    →  $12.5K
 *       980      →  $980
 */
export function formatCompact(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '—';
  if (num >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: num % 1_000_000 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(num);
  }
  if (num >= 1_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(num);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
