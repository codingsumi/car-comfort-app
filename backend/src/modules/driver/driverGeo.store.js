const { getEmitterRedis } = require('../realtime/redisClients');

const GEO_KEY = process.env.DRIVERS_GEO_REDIS_KEY || 'drivers:locations';

function lastLocationKey(driverUserId) {
  return `driver:last_location:${Number(driverUserId)}`;
}

/**
 * Persist driver position for GEO radius queries + last-location key.
 * Redis GEO order: longitude, latitude, member.
 */
async function recordDriverGeoPosition(driverUserId, lat, lng) {
  const redis = getEmitterRedis();
  const id = String(Number(driverUserId));
  const latitude = Number(lat);
  const longitude = Number(lng);
  await redis.geoadd(GEO_KEY, longitude, latitude, id);
  await redis.set(lastLocationKey(id), JSON.stringify({ lat: latitude, lng: longitude }), 'EX', 60 * 60 * 24 * 7);
}

/**
 * @param {number} lng
 * @param {number} lat
 * @param {number} radiusKm
 * @returns {Promise<Array<{ id: number, lat: number, lng: number, distKm: number }>>}
 */
async function geoRadiusDrivers(lng, lat, radiusKm) {
  const redis = getEmitterRedis();
  const rows = await redis.georadius(
    GEO_KEY,
    Number(lng),
    Number(lat),
    Number(radiusKm),
    'km',
    'WITHCOORD',
    'WITHDIST',
    'ASC'
  );
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((row) => {
    const [member, distKm, coord] = row;
    const id = Number(member);
    const [memberLng, memberLat] = coord;
    return {
      id,
      lat: Number(memberLat),
      lng: Number(memberLng),
      distKm: Number(distKm)
    };
  });
}

module.exports = {
  GEO_KEY,
  lastLocationKey,
  recordDriverGeoPosition,
  geoRadiusDrivers
};
