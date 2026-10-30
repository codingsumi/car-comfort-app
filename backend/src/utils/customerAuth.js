const { HttpError } = require('./httpError');

function assertCustomerAuth(req) {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.role !== 'customer') throw new HttpError(403, 'Forbidden');
  return req.auth.userId;
}

module.exports = {
  assertCustomerAuth
};
