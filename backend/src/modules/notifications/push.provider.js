const db = require('../../models');
const { logger } = require('../../config/logger');
const { isOneSignalConfigured } = require('../../config/onesignal');
const { sendOneSignalPushToSubscriptions } = require('./onesignal.send');

function maskId(value) {
  const s = String(value || '');
  if (s.length <= 10) return s ? '***' : '';
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

/**
 * Queue worker entry: load active OneSignal subscription ids for user, send via official SDK.
 */
async function sendPushToUser(userId, { title, body, data, idempotencyKey }) {
  const uid = Number(userId);
  const devices = await db.UserDevice.findAll({
    where: { user_id: uid, is_active: true },
    attributes: ['onesignal_id', 'platform']
  });

  const subscriptionIds = devices.map((d) => d.onesignal_id).filter(Boolean);
  logger.info('push_user_devices_loaded', {
    userId: uid,
    activeDeviceCount: devices.length,
    subscriptionCount: subscriptionIds.length,
    platforms: [...new Set(devices.map((d) => d.platform).filter(Boolean))],
    subscriptionIds: subscriptionIds.map(maskId)
  });

  if (!subscriptionIds.length) {
    logger.warn('push_skipped_no_active_devices', { userId: uid });
    return { skipped: true, reason: 'no_active_devices' };
  }

  if (!isOneSignalConfigured()) {
    logger.error('push_skipped_onesignal_not_configured', { userId: uid });
    const err = new Error('OneSignal is not configured');
    err.code = 'ONESIGNAL_NOT_CONFIGURED';
    throw err;
  }

  const mergedData = {
    ...(data && typeof data === 'object' ? data : {}),
    user_id: String(uid)
  };

  logger.info('push_send_attempt', {
    userId: uid,
    title,
    bodyLength: String(body || '').length,
    dataKeys: Object.keys(mergedData),
    idempotencyKey
  });

  return sendOneSignalPushToSubscriptions({
    subscriptionIds,
    title,
    body,
    data: mergedData,
    idempotencyKey: idempotencyKey || mergedData.uniqueKey
  });
}

module.exports = { sendPushToUser };
