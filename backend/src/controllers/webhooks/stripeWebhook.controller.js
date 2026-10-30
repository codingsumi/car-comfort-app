'use strict';

const { logger } = require('../../config/logger');
const { processStripeWebhookRequest } = require('../../services/stripeWebhook.service');

async function handleStripeWebhook(req, res) {
  try {
    const data = await processStripeWebhookRequest(req);
    return res.status(200).json({ received: true, ...data });
  } catch (err) {
    const status = err.status || 400;
    logger.error('stripe_webhook_handler_error', {
      message: err?.message,
      status,
      type: err?.type,
    });
    return res.status(status).json({
      received: false,
      error: err.message || 'Webhook processing failed',
    });
  }
}

module.exports = { handleStripeWebhook };
