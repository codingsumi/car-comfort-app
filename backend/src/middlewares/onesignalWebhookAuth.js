const { loadOneSignalConfig, isOneSignalWebhookConfigured } = require('../config/onesignal');
const { logger } = require('../config/logger');

/**
 * Verify Authorization: Bearer <ONESIGNAL_WEBHOOK_SECRET>
 */
function onesignalWebhookAuth(req, res, next) {
  if (!isOneSignalWebhookConfigured()) {
    logger.warn('onesignal_webhook_not_configured');
    return res.status(503).json({ error: 'OneSignal webhook secret is not configured' });
  }

  const expected = loadOneSignalConfig().webhookSecret;
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || token !== expected) {
    logger.warn('onesignal_webhook_unauthorized', { hasToken: Boolean(token) });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

module.exports = { onesignalWebhookAuth };
