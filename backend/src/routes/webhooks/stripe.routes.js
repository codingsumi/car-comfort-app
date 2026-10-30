'use strict';

const express = require('express');
const { handleStripeWebhook } = require('../../controllers/webhooks/stripeWebhook.controller');

const router = express.Router();

// Stripe delivers signed POST events. Make browser/manual GET checks explicit
// without accepting an unsigned event as a successful webhook delivery.
router.get('/', (_req, res) => {
  return res.status(405).json({
    received: false,
    error: 'Method not allowed. Stripe webhooks must use POST with a Stripe-Signature header.',
  });
});

router.post('/', handleStripeWebhook);

module.exports = router;
