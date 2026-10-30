const { Op } = require('sequelize');

const db = require('../../models');
const { haversineMeters } = require('../utils/haversine');
const { geoRadiusDrivers } = require('./driverGeo.store');
const { logger } = require('../../config/logger');

/** 50 miles in kilometers — full job board radius */
const NEARBY_RADIUS_KM = 50 * 1.609344;

/** Strict cap in meters (Haversine re-check on GEO hits) */
const NEARBY_RADIUS_M = NEARBY_RADIUS_KM * 1000;

/** 10 miles — on-demand auto-dispatch zone (preferred first target) */
const ON_DEMAND_AUTO_RADIUS_MILES = 10;
const ON_DEMAND_AUTO_RADIUS_KM = ON_DEMAND_AUTO_RADIUS_MILES * 1.609344;
const ON_DEMAND_AUTO_RADIUS_M = ON_DEMAND_AUTO_RADIUS_KM * 1000;

/** 50 miles — max radius for self-service acceptance */
const MAX_SELF_ACCEPT_RADIUS_MILES = 50;
const MAX_SELF_ACCEPT_RADIUS_M = MAX_SELF_ACCEPT_RADIUS_MILES * 1.609344 * 1000;

/**
 * Bounding-box prefilter on users.latitude / users.longitude (degrees).
 * ~1° latitude ≈ 111 km — pad beyond radius for longitude shrink at high |lat|.
 */
function latLngBounds(lat, lng, padKm) {
  const pad = padKm / 111;
  const cos = Math.cos((Math.abs(Number(lat)) * Math.PI) / 180) || 0.2;
  const padLng = padKm / (111 * Math.max(cos, 0.2));
  return {
    latMin: Number(lat) - pad,
    latMax: Number(lat) + pad,
    lngMin: Number(lng) - padLng,
    lngMax: Number(lng) + padLng
  };
}

function bookingCoords(bookingPlain) {
  const lat = bookingPlain.service_lat ?? bookingPlain.service_latitude ?? bookingPlain.latitude;
  const lng = bookingPlain.service_lng ?? bookingPlain.service_longitude ?? bookingPlain.longitude;
  const la = lat === null || lat === undefined ? null : Number(lat);
  const ln = lng === null || lng === undefined ? null : Number(lng);
  if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/**
 * Approved drivers near (lat,lng) within 50 miles.
 * 1) Redis GEO radius (efficient).
 * 2) Haversine verification on each GEO hit.
 * 3) If GEO empty, bounded SQL on users + driver_profiles + Haversine in memory.
 *
 * @returns {Promise<number[]>} distinct driver user_ids
 */
async function findNearbyApprovedDriverUserIds(lat, lng) {
  let candidates = [];
  try {
    candidates = await geoRadiusDrivers(lng, lat, NEARBY_RADIUS_KM);
  } catch (err) {
    logger.warn('geoRadiusDrivers failed, falling back to SQL', { message: err?.message });
    candidates = [];
  }

  const fromGeo = [];
  const seen = new Set();
  for (const c of candidates) {
    if (!c.id || c.id < 1) continue;
    const m = haversineMeters(lat, lng, c.lat, c.lng);
    if (m > NEARBY_RADIUS_M) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    fromGeo.push(c.id);
  }

  if (fromGeo.length) {
    const rows = await db.User.findAll({
      where: {
        id: { [Op.in]: fromGeo },
        role: 'driver',
        status: 'active',
      },
      attributes: ['id'],
      include: [
        {
          model: db.DriverProfile,
          as: 'driver_profile',
          required: true,
          attributes: [],
          where: {
            approval_status: 'approved',
            license_hold_active: false,
          },
        },
      ],
    });
    const approved = new Set(rows.map((r) => Number(r.id)));
    return fromGeo.filter((id) => approved.has(id));
  }

  const { latMin, latMax, lngMin, lngMax } = latLngBounds(lat, lng, NEARBY_RADIUS_KM + 5);

  const users = await db.User.findAll({
    where: {
      role: 'driver',
      status: 'active',
      latitude: { [Op.between]: [latMin, latMax] },
      longitude: { [Op.between]: [lngMin, lngMax] },
    },
    attributes: ['id', 'latitude', 'longitude'],
    include: [
      {
        model: db.DriverProfile,
        as: 'driver_profile',
        required: true,
        attributes: [],
        where: {
          approval_status: 'approved',
          license_hold_active: false,
        },
      },
    ],
    limit: 2000,
  });

  const out = [];
  const seen2 = new Set();
  for (const u of users) {
    const plain = u.get({ plain: true });
    const ulat = plain.latitude == null ? null : Number(plain.latitude);
    const ulng = plain.longitude == null ? null : Number(plain.longitude);
    if (ulat == null || ulng == null || !Number.isFinite(ulat) || !Number.isFinite(ulng)) continue;
    const m = haversineMeters(lat, lng, ulat, ulng);
    if (m > NEARBY_RADIUS_M) continue;
    const id = Number(plain.id);
    if (seen2.has(id)) continue;
    seen2.add(id);
    out.push(id);
  }
  return out;
}

/**
 * On-demand dispatch: find approved drivers within 0-10 miles first.
 * Falls back to 0-50 miles if the 10-mile zone returns no results.
 * Returns { driverIds, radiusMiles } so callers know which radius was used.
 */
async function findDriversForOnDemandDispatch(lat, lng) {
  // Attempt 0-10 mile zone first
  const nearDrivers = [];
  try {
    const candidates = await geoRadiusDrivers(lng, lat, ON_DEMAND_AUTO_RADIUS_KM);
    const seen = new Set();
    for (const c of candidates) {
      if (!c.id || c.id < 1) continue;
      const m = haversineMeters(lat, lng, c.lat, c.lng);
      if (m > ON_DEMAND_AUTO_RADIUS_M) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      nearDrivers.push(c.id);
    }
  } catch (err) {
    logger.warn('findDriversForOnDemandDispatch geoRadius failed', { message: err?.message });
  }

  if (nearDrivers.length) {
    const rows = await db.User.findAll({
      where: { id: { [Op.in]: nearDrivers }, role: 'driver', status: 'active' },
      attributes: ['id'],
      include: [{
        model: db.DriverProfile, as: 'driver_profile', required: true, attributes: [],
        where: { approval_status: 'approved', license_hold_active: false },
      }],
    });
    const approved = new Set(rows.map((r) => Number(r.id)));
    const eligible = nearDrivers.filter((id) => approved.has(id));
    if (eligible.length) {
      return { driverIds: eligible, radiusMiles: ON_DEMAND_AUTO_RADIUS_MILES };
    }
  }

  // Fall back to full 50-mile radius
  const allNear = await findNearbyApprovedDriverUserIds(lat, lng);
  return { driverIds: allNear, radiusMiles: MAX_SELF_ACCEPT_RADIUS_MILES };
}

module.exports = {
  NEARBY_RADIUS_KM,
  NEARBY_RADIUS_M,
  ON_DEMAND_AUTO_RADIUS_MILES,
  ON_DEMAND_AUTO_RADIUS_M,
  MAX_SELF_ACCEPT_RADIUS_MILES,
  MAX_SELF_ACCEPT_RADIUS_M,
  bookingCoords,
  findNearbyApprovedDriverUserIds,
  findDriversForOnDemandDispatch,
};
