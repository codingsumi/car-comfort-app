const { ingestDriverLocation } = require('../modules/driver/locationIngest.service');

async function postLocation(req, res, next) {
  try {
    const data = await ingestDriverLocation({ ...req.body, auth: req.auth });
    res.success('ok', data);
  } catch (e) {
    next(e);
  }
}

module.exports = { postLocation };
