const db = require('../../models');
const { logger } = require('../../config/logger');

/**
 * Persist a single inbox row per queue delivery_key (idempotent with notification_logs).
 */
async function ensureInboxNotification({ userId, bookingId, notificationType, deliveryKey, title, message, data }) {
  const key = String(deliveryKey);
  try {
    const [row] = await db.AppNotification.findOrCreate({
      where: { delivery_key: key },
      defaults: {
        delivery_key: key,
        user_id: Number(userId),
        booking_id: bookingId ? Number(bookingId) : null,
        notification_type: String(notificationType),
        title: String(title || ''),
        message: String(message || ''),
        data: data && typeof data === 'object' ? data : {},
        is_read: false
      }
    });
    return row;
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return db.AppNotification.findOne({ where: { delivery_key: key } });
    }
    logger.error('ensureInboxNotification failed', { deliveryKey: key, message: err?.message });
    throw err;
  }
}

module.exports = { ensureInboxNotification };
