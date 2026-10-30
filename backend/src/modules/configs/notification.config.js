const { SCHEDULED_REMINDER_OFFSETS_MIN } = require('../../constants/bookingNotification.constants');

function parseOffsets(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function loadNotificationConfig() {
  const enrouteRepeatMs = Number(process.env.NOTIFY_ENROUTE_REPEAT_MS || 300000);
  const envOffsets = parseOffsets(process.env.NOTIFY_REMINDER_OFFSETS_MIN);
  const reminderOffsetsMin = envOffsets.length
    ? envOffsets
    : [...SCHEDULED_REMINDER_OFFSETS_MIN];
  return {
    queueName: process.env.NOTIFICATION_QUEUE_NAME || 'notification_queue',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    workerConcurrency: Math.max(1, Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 8)),
    enrouteRepeatMs: Number.isFinite(enrouteRepeatMs) && enrouteRepeatMs >= 0 ? enrouteRepeatMs : 300000,
    reminderOffsetsMin,
    /** Distance bucket outer edges in meters — descending from far to near. */
    bucketGt2M: Number(process.env.NOTIFY_BUCKET_M_GT2 || 2000),
    bucketInner2KmM: Number(process.env.NOTIFY_BUCKET_M_2KM || 1000),
    bucketInner1KmM: Number(process.env.NOTIFY_BUCKET_M_1KM || 500),
    bucketArrivedM: Number(process.env.NOTIFY_BUCKET_M_ARRIVED || 100)
  };
}

function shouldEmbedNotificationWorker() {
  if (process.env.NOTIFICATION_WORKER_DISABLED === 'true') return false;
  if (process.env.NOTIFICATION_EMBED_WORKER === 'true') return true;
  if (process.env.NOTIFICATION_EMBED_WORKER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

module.exports = { loadNotificationConfig, shouldEmbedNotificationWorker };
