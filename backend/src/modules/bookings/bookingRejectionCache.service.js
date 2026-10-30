const { getEmitterRedis } = require('../realtime/redisClients');
const { logger } = require('../../config/logger');

function parsePositiveInt(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rejectionKey(bookingId) {
  return `booking:${Number(bookingId)}:rejected_drivers`;
}

async function markDriverRejected({ bookingId, driverUserId }) {
  const bid = parsePositiveInt(bookingId);
  const uid = parsePositiveInt(driverUserId);
  if (!bid || !uid) return { ok: false, reason: 'invalid_input' };
  const redis = getEmitterRedis();
  await redis.sadd(rejectionKey(bid), String(uid));
  return { ok: true };
}

async function clearDriverRejection({ bookingId, driverUserId }) {
  const bid = parsePositiveInt(bookingId);
  const uid = parsePositiveInt(driverUserId);
  if (!bid || !uid) return { ok: false, reason: 'invalid_input' };
  const redis = getEmitterRedis();
  await redis.srem(rejectionKey(bid), String(uid));
  return { ok: true };
}

async function filterDriversNotRejectedForBooking({ bookingId, driverUserIds }) {
  const bid = parsePositiveInt(bookingId);
  const ids = Array.from(new Set((driverUserIds || []).map((v) => parsePositiveInt(v)).filter(Boolean)));
  if (!bid || !ids.length) return [];

  const redis = getEmitterRedis();
  const key = rejectionKey(bid);
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.sismember(key, String(id));
  const result = await pipeline.exec();
  if (!Array.isArray(result)) return ids;

  const eligible = [];
  for (let i = 0; i < ids.length; i += 1) {
    const entry = result[i];
    const err = entry?.[0];
    const val = Number(entry?.[1] || 0);
    if (err) {
      logger.warn('Redis rejection check failed', { bookingId: bid, driverUserId: ids[i], message: err?.message });
      eligible.push(ids[i]);
      continue;
    }
    if (val !== 1) eligible.push(ids[i]);
  }
  return eligible;
}

async function isDriverRejectedForBookings({ bookingIds, driverUserId }) {
  const uid = parsePositiveInt(driverUserId);
  const bids = Array.from(new Set((bookingIds || []).map((v) => parsePositiveInt(v)).filter(Boolean)));
  const out = new Map();
  if (!uid || !bids.length) return out;

  const redis = getEmitterRedis();
  const pipeline = redis.pipeline();
  for (const bid of bids) pipeline.sismember(rejectionKey(bid), String(uid));
  const result = await pipeline.exec();
  if (!Array.isArray(result)) return out;

  for (let i = 0; i < bids.length; i += 1) {
    const entry = result[i];
    const err = entry?.[0];
    const val = Number(entry?.[1] || 0);
    if (err) {
      logger.warn('Redis rejection map check failed', { bookingId: bids[i], driverUserId: uid, message: err?.message });
      out.set(bids[i], false);
      continue;
    }
    out.set(bids[i], val === 1);
  }
  return out;
}

module.exports = {
  markDriverRejected,
  clearDriverRejection,
  filterDriversNotRejectedForBooking,
  isDriverRejectedForBookings
};
