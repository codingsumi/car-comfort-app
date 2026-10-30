function loadRealtimeConfig() {
  const minDistanceM = Number(process.env.REALTIME_MIN_DISTANCE_M || 35);
  const minIntervalMs = Number(process.env.REALTIME_MIN_INTERVAL_MS || 2500);
  return {
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    redisChannel: process.env.REALTIME_REDIS_CHANNEL || 'driver_location_update',
    throttleKeyPrefix: process.env.REALTIME_THROTTLE_KEY_PREFIX || 'rt:loc:last:',
    minDistanceM: Number.isFinite(minDistanceM) && minDistanceM > 0 ? minDistanceM : 35,
    minIntervalMs: Number.isFinite(minIntervalMs) && minIntervalMs >= 500 ? minIntervalMs : 2500,
    socketPath: process.env.SOCKET_PATH || '/socket.io',
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || '*'
  };
}

module.exports = { loadRealtimeConfig };
