'use strict';

const { markCustomerNoShowAsDriver } = require('../services/bookingCustomerNoShow.service');
const { logger } = require('../config/logger');

async function postCustomerNoShow(req, res, next) {
  try {
    const result = await markCustomerNoShowAsDriver({
      bookingId: req.params.id,
      driverUserId: req.auth?.userId,
      reason: req.body?.reason,
    });
    return res.success('Customer no-show recorded', result);
  } catch (err) {
    logger.error('driver_customer_no_show_failed', {
      bookingId: req.params.id,
      message: err?.message,
    });
    return next(err);
  }
}

module.exports = { postCustomerNoShow };
