/**
 * Distance between two WGS84 points in meters. Optimized for hot paths — no allocations.
 * @returns {number} great-circle distance in meters
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const r = 6371000;
  const p1 = (Number(lat1) * Math.PI) / 180;
  const p2 = (Number(lat2) * Math.PI) / 180;
  const dp = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dl = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return r * c;
}

module.exports = { haversineMeters };
