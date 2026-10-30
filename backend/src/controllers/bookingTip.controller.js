const { createBookingTip, getBookingTip } = require('../services/bookingTip.service');

async function postBookingTip(req, res, next) {
  try {
    const data = await createBookingTip({
      bookingId: req.params.id,
      auth: req.auth || {},
      body: req.body,
    });
    return res.success('Tip submitted', data);
  } catch (err) {
    return next(err);
  }
}

async function getBookingTipHandler(req, res, next) {
  try {
    const data = await getBookingTip({
      bookingId: req.params.id,
      auth: req.auth || {},
    });
    return res.success('Tip fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { postBookingTip, getBookingTip: getBookingTipHandler };
