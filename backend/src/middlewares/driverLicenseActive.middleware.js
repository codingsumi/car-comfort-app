const db = require('../models');
const { HttpError } = require('../utils/httpError');
const {
  assertDriverLicenseEligible,
  buildDriverLicenseComplianceStatus,
  ensureDriverLicenseComplianceForUser,
} = require('../services/driverLicenseCompliance.service');

async function assertDriverCanOperate(req, _res, next) {
  try {
    if (req.auth?.role !== 'driver') return next();
    await assertDriverLicenseEligible({ userId: req.auth.userId });
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadDriverLicenseComplianceForUser(userId) {
  const result = await ensureDriverLicenseComplianceForUser(userId);
  if (!result) return null;

  const { user, profile } = result;
  return {
    user: {
      status: user.status,
      suspended_reason: user.suspended_reason,
    },
    license_compliance: buildDriverLicenseComplianceStatus(user, profile),
  };
}

module.exports = {
  assertDriverCanOperate,
  loadDriverLicenseComplianceForUser,
};
