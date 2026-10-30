const { processOnesignalWebhook } = require('../../services/onesignalWebhook.service');
const { logger } = require('../../config/logger');

async function handleOnesignalEvent(req, res) {
  try {
    const result = await processOnesignalWebhook(req.body);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('onesignal_webhook_handler_error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}

module.exports = { handleOnesignalEvent };
