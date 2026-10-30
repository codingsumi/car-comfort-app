const { HttpError } = require('../utils/httpError');

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCoords({ latitude, longitude }) {
  const lat = toNumberOrNull(latitude);
  const lng = toNumberOrNull(longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getDrivingDistancesMeters({ origin, destinations }) {
  const token = String(process.env.MAPBOX_ACCESS_TOKEN || '').trim();
  if (!token) return null;

  const o = normalizeCoords(origin);
  if (!o) return null;

  const dests = (destinations || []).map(normalizeCoords).filter(Boolean);
  if (!dests.length) return [];

  // Mapbox matrix: up to 25 coordinates total.
  const groups = chunk(dests, 24);
  const distances = [];

  for (const g of groups) {
    const coords = [o, ...g].map((c) => `${c.longitude},${c.latitude}`).join(';');
    const url =
      `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}` +
      `?sources=0&destinations=${g.map((_, i) => i + 1).join(';')}` +
      `&annotations=distance&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(url);
    const raw = await res.text();
    if (!res.ok) {
      const err = new HttpError(502, 'Mapbox distance lookup failed');
      err.details = { status: res.status };
      throw err;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (_e) {
      throw new HttpError(502, 'Mapbox distance lookup failed');
    }

    const row = Array.isArray(json?.distances) ? json.distances[0] : null;
    if (!Array.isArray(row)) throw new HttpError(502, 'Mapbox distance lookup failed');

    for (let i = 0; i < g.length; i += 1) {
      const m = row[i];
      distances.push(m === null || m === undefined ? null : Number(m));
    }
  }

  return distances;
}

/**
 * Total driving distance along ordered waypoints (pickup → service stop(s) → return).
 */
async function getDrivingRouteDistanceMeters(coords) {
  const token = String(process.env.MAPBOX_ACCESS_TOKEN || '').trim();
  if (!token) return null;

  const points = (coords || [])
    .map((c) => normalizeCoords({ latitude: c?.lat, longitude: c?.lng }))
    .filter(Boolean);
  if (points.length < 2) return null;

  const coordStr = points.map((c) => `${c.longitude},${c.latitude}`).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}` +
    `?overview=false&geometries=geojson&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const raw = await res.text();
  if (!res.ok) {
    const err = new HttpError(502, 'Mapbox route distance lookup failed');
    err.details = { status: res.status };
    throw err;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (_e) {
    throw new HttpError(502, 'Mapbox route distance lookup failed');
  }

  const distance = json?.routes?.[0]?.distance;
  if (distance === null || distance === undefined) return null;
  const meters = Number(distance);
  return Number.isFinite(meters) && meters > 0 ? meters : null;
}

async function geocodeAddressToCoords(address) {
  const token = String(process.env.MAPBOX_ACCESS_TOKEN || '').trim();
  const q = String(address || '').trim();
  if (!token || !q) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?limit=1&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const raw = await res.text();
  if (!res.ok) {
    const err = new HttpError(502, 'Mapbox geocoding lookup failed');
    err.details = { status: res.status };
    throw err;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (_e) {
    throw new HttpError(502, 'Mapbox geocoding lookup failed');
  }

  const center = json?.features?.[0]?.center;
  if (!Array.isArray(center) || center.length < 2) return null;

  const lng = Number(center[0]);
  const lat = Number(center[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

module.exports = {
  getDrivingDistancesMeters,
  getDrivingRouteDistanceMeters,
  geocodeAddressToCoords,
};

