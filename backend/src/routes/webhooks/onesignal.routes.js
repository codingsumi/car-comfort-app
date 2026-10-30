const express = require('express');
const router = express.Router();
const { onesignalWebhookAuth } = require('../../middlewares/onesignalWebhookAuth');
const { handleOnesignalEvent } = require('../../controllers/webhooks/onesignalWebhook.controller');

router.post('/events', onesignalWebhookAuth, handleOnesignalEvent);

module.exports = router;
