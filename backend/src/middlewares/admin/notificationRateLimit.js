const { HttpError } = require('../../utils/httpError');

const WINDOW_MS = 60 * 1000;
const MAX_SENDS = 10;
const hits = new Map();

function notificationSendRateLimit(req, res, next) {
  const adminId = req.auth?.userId || 'anon';
  const key = `send:${adminId}`;
  const now = Date.now();
  const entry = hits.get(key) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count += 1;
  hits.set(key, entry);

  if (entry.count > MAX_SENDS) {
    return next(new HttpError(429, 'Too many notification sends. Please wait before trying again.'));
  }

  return next();
}

module.exports = { notificationSendRateLimit };
