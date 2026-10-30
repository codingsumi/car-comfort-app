const db = require('../models');
const { getSettingByKey } = require('../services/settings.service');
const { HttpError } = require('../utils/httpError');

let cachedMaintenance = null;
let cacheTime = 0;
const CACHE_MS = 60 * 1000;

async function isMaintenanceModeEnabled() {
  const now = Date.now();
  if (cachedMaintenance !== null && now - cacheTime < CACHE_MS) {
    return cachedMaintenance;
  }

  try {
    const setting = await getSettingByKey(db, 'maintenance_mode_enabled');
    cachedMaintenance = setting?.value === true || setting?.value === 'true';
  } catch {
    cachedMaintenance = false;
  }
  cacheTime = now;
  return cachedMaintenance;
}

function invalidateMaintenanceCache() {
  cachedMaintenance = null;
  cacheTime = 0;
}

const DEFAULT_MAINTENANCE_MESSAGE =
  'We are currently performing scheduled maintenance. Please check back soon.';

async function getMaintenanceStatus() {
  const enabled = await isMaintenanceModeEnabled();
  if (!enabled) {
    return { enabled: false, message: null, expected_return: null };
  }

  const messageSetting = await getSettingByKey(db, 'maintenance_message');
  const returnSetting = await getSettingByKey(db, 'maintenance_expected_return');

  return {
    enabled: true,
    message: messageSetting?.value || DEFAULT_MAINTENANCE_MESSAGE,
    expected_return: returnSetting?.value || null,
  };
}

function maintenanceModeGuard() {
  return async (req, res, next) => {
    try {
      const status = await getMaintenanceStatus();
      if (!status.enabled) return next();

      throw new HttpError(503, status.message, {
        maintenance: true,
        expected_return: status.expected_return,
      });
    } catch (err) {
      if (err.status === 503) return next(err);
      return next();
    }
  };
}

module.exports = {
  maintenanceModeGuard,
  invalidateMaintenanceCache,
  isMaintenanceModeEnabled,
  getMaintenanceStatus,
};
