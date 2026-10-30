const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { recordDriverGeoPosition } = require('./driverGeo.store');

async function assertApprovedDriver(userId) {
  const profile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!profile) throw new HttpError(403, 'Service provider profile required');
  if (profile.approval_status && profile.approval_status !== 'approved') {
    throw new HttpError(403, 'Service provider not approved');
  }
}

/**
 * Drivers call this while online to register for nearby booking alerts (Redis GEO + users lat/lng).
 */
async function updateDriverPresence({ auth, lat, lng }) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Forbidden');

  const userId = Number(auth.userId);
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new HttpError(400, 'lat and lng must be numbers');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new HttpError(400, 'lat/lng out of range');
  }

  await assertApprovedDriver(userId);

  await recordDriverGeoPosition(userId, latitude, longitude);
  await db.User.update(
    { latitude, longitude },
    { where: { id: userId, role: 'driver' } }
  );

  return { ok: true, latitude, longitude };
}

module.exports = { updateDriverPresence, assertApprovedDriver };
