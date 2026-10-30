'use strict';

const { applyTrackingStatus, verifyPickupOtp } = require('../modules/bookings/bookingTracking.service');
const { logger } = require('../config/logger');

async function postTrackingStatus(req, res) {
  try {
    const result = await applyTrackingStatus(req.params.id, req.body.tracking_status, req.auth, req);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    logger.error('booking_tracking_status_error', {
      bookingId: req.params.id,
      tracking_status: req.body?.tracking_status,
      message: err?.message,
      stack: status === 500 ? err?.stack : undefined
    });
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
}

async function postVerifyOtp(req, res) {
  try {
    const result = await verifyPickupOtp(req.params.id, req.body.otp, req.auth);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    logger.error('booking_verify_otp_error', {
      bookingId: req.params.id,
      message: err?.message,
      stack: status === 500 ? err?.stack : undefined
    });
    return res.status(status).json({ error: err.message || 'Internal server error' });
  }
}

module.exports = { postTrackingStatus, postVerifyOtp };
