const { Emitter } = require('@socket.io/redis-emitter');
const { haversineMeters } = require('../utils/haversine');
const { loadRealtimeConfig } = require('../configs/realtime.config');
const { getEmitterRedis } = require('./redisClients');
const { logger } = require('../../config/logger');
const { ADMIN_ROOM } = require('./adminSocketEmitter');

let _emitter;

function getIoEmitter() {
  if (!_emitter) {
    _emitter = new Emitter(getEmitterRedis());
  }
  return _emitter;
}

function roomName(bookingId) {
  return `booking_${Number(bookingId)}`;
}

/**
 * Throttle: publish if enough time passed OR enough distance moved (see env).
 * Redis stores last published sample per booking for horizontal scaling.
 */
async function shouldPublishAndUpdateSample({ redis, throttleKey, lat, lng, now, cfg }) {
  const raw = await redis.get(throttleKey);
  let prev = null;
  if (raw) {
    try {
      prev = JSON.parse(raw);
    } catch (_) {
      prev = null;
    }
  }

  if (!prev || typeof prev.lat !== 'number' || typeof prev.lng !== 'number' || typeof prev.t !== 'number') {
    await redis.set(throttleKey, JSON.stringify({ lat, lng, t: now }), 'EX', 86400);
    return true;
  }

  const dt = now - prev.t;
  if (dt >= cfg.minIntervalMs) {
    await redis.set(throttleKey, JSON.stringify({ lat, lng, t: now }), 'EX', 86400);
    return true;
  }

  const moved = haversineMeters(prev.lat, prev.lng, lat, lng);
  if (moved >= cfg.minDistanceM) {
    await redis.set(throttleKey, JSON.stringify({ lat, lng, t: now }), 'EX', 86400);
    return true;
  }

  return false;
}

/**
 * Event bus (raw Redis PUB/SUB) + Socket.IO cross-node emit via redis-emitter.
 * Failures are logged; REST flow must not throw for realtime-only errors.
 */
async function publishDriverLocationRealtime({ bookingId, providerId, lat, lng }) {
  const cfg = loadRealtimeConfig();
  const redis = getEmitterRedis();
  const throttleKey = `${cfg.throttleKeyPrefix}${bookingId}`;
  const now = Date.now();

  let accepted;
  try {
    accepted = await shouldPublishAndUpdateSample({
      redis,
      throttleKey,
      lat,
      lng,
      now,
      cfg
    });
  } catch (err) {
    logger.warn('realtime throttle read failed', { bookingId, message: err?.message });
    accepted = true;
  }

  if (!accepted) {
    return { published: false, reason: 'throttled' };
  }

  const payload = {
    lat: Number(lat),
    lng: Number(lng),
    timestamp: now
  };

  const busPayload = JSON.stringify({
    bookingId: Number(bookingId),
    providerId: Number(providerId),
    lat: payload.lat,
    lng: payload.lng,
    timestamp: now
  });

  try {
    await redis.publish(cfg.redisChannel, busPayload);
  } catch (err) {
    logger.warn('realtime redis publish failed', { bookingId, message: err?.message });
  }

  try {
    getIoEmitter().of('/').to(roomName(bookingId)).emit('location_update', payload);
  } catch (err) {
    logger.warn('realtime socket emitter failed', { bookingId, message: err?.message });
  }

  try {
    getIoEmitter().of('/').to(ADMIN_ROOM).emit('provider_location_updated', {
      booking_id: Number(bookingId),
      provider_id: Number(providerId),
      lat: Number(lat),
      lng: Number(lng),
      timestamp: now,
    });
  } catch (err) {
    logger.warn('admin realtime location emit failed', { bookingId, message: err?.message });
  }

  return { published: true };
}

module.exports = { publishDriverLocationRealtime, roomName, getIoEmitter };
