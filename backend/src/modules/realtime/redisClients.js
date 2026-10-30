const IORedis = require('ioredis');
const { loadRealtimeConfig } = require('../configs/realtime.config');

let _pub;
let _sub;
let _emitter;

/**
 * Redis clients for Socket.IO adapter (pub/sub pair must be independent duplicates).
 * @see https://socket.io/docs/v4/redis-adapter/
 */
function getAdapterPubSub() {
  if (!_pub) {
    const { redisUrl } = loadRealtimeConfig();
    _pub = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    _sub = _pub.duplicate();
  }
  return { pubClient: _pub, subClient: _sub };
}

/**
 * Dedicated client for @socket.io/redis-emitter (do not share with Bull or adapter pair).
 */
function getEmitterRedis() {
  if (!_emitter) {
    const { redisUrl } = loadRealtimeConfig();
    _emitter = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return _emitter;
}

module.exports = { getAdapterPubSub, getEmitterRedis };
