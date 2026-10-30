const { applyDispatchTrackingStatus } = require('../modules/bookings/dispatchStatus.service');

async function postStatus(req, res, next) {
  try {
    const data = await applyDispatchTrackingStatus(req.params.id, req.body.status, req.auth);
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

module.exports = { postStatus };
