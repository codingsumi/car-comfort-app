const IORedis = require('ioredis');
const { loadNotificationConfig } = require('./notification.config');

/**
 * Dedicated connection factory for BullMQ (each Worker/Queue prefers its own ioredis instance).
 */
function createRedisConnection() {
  const { redisUrl } = loadNotificationConfig();
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null
  });
}

module.exports = { createRedisConnection };
