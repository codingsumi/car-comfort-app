const { updateDriverPresence } = require('../modules/driver/driverPresence.service');

async function postPresence(req, res, next) {
  try {
    const data = await updateDriverPresence({
      auth: req.auth,
      lat: req.body.lat,
      lng: req.body.lng
    });
    return res.success('ok', data);
  } catch (e) {
    return next(e);
  }
}

module.exports = { postPresence };
