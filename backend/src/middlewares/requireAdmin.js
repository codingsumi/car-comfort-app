const { HttpError } = require('../utils/httpError');

function requireAdmin(req, _res, next) {
  try {
    const role = req.auth?.role;
    if (role !== 'admin') throw new HttpError(403, 'Forbidden');
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAdmin };

