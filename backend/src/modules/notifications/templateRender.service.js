const ALLOWED_VARS = new Set([
  'customer_name',
  'provider_name',
  'booking_id',
  'service_type',
  'amount',
]);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace {{variable}} placeholders with sanitized values.
 */
function renderTemplate(str, variables = {}) {
  if (!str) return '';
  let out = String(str);
  for (const [key, raw] of Object.entries(variables)) {
    if (!ALLOWED_VARS.has(key)) continue;
    const val = raw == null ? '' : String(raw).slice(0, 500);
    out = out.replace(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'gi'), val);
  }
  return out;
}

module.exports = { renderTemplate, ALLOWED_VARS };
