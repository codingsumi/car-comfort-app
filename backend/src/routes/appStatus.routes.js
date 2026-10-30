'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const appStatusController = require('../controllers/appStatus.controller');

const router = Router();

const statusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { status: 'error', message: 'Too many status requests, please try again later' },
});

router.get('/status', statusRateLimit, appStatusController.getAppStatus);

module.exports = router;
