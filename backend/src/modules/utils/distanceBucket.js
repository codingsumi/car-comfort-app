const { loadNotificationConfig } = require('../configs/notification.config');

/**
 * Map straight-line distance (m) to a stable bucket label for idempotent notifications.
 */
function distanceToBucket(meters, cfg = loadNotificationConfig()) {
  const d = Number(meters);
  if (!Number.isFinite(d) || d < 0) return 'unknown';
  if (d <= cfg.bucketArrivedM) return 'arrived';
  if (d <= cfg.bucketInner1KmM) return '500m';
  if (d <= cfg.bucketInner2KmM) return '1km';
  if (d <= cfg.bucketGt2M) return '2km';
  return '>2km';
}

module.exports = { distanceToBucket };
