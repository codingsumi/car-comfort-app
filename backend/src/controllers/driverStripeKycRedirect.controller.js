'use strict';

const { resolveKycAppTarget } = require('../utils/kycRedirectUrls');

/**
 * Stripe Account Link return/refresh hits these routes; we 302 to the driver app URL.
 */
function redirectKyc(req, res) {
  const kind = String(req.params.kind || '').toLowerCase();
  const allowed = new Set(['success', 'error', 'refresh']);
  const targetKind = allowed.has(kind) ? kind : 'error';
  const target = resolveKycAppTarget(targetKind);
  return res.redirect(302, target);
}

module.exports = { redirectKyc };
