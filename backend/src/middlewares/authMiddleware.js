const jwt = require('jsonwebtoken');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { ACCOUNT_DELETED_MESSAGE, getBlockedAccountMessage } = require('../utils/accountStatus');

async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Unauthorized');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new HttpError(500, 'JWT_SECRET is not configured');

    const payload = jwt.verify(token, secret);
    if (!payload?.userId || !payload?.role) throw new HttpError(401, 'Unauthorized');

    const user = await db.User.findByPk(payload.userId);
    if (!user) throw new HttpError(401, 'Unauthorized');
    const blockedMessage = await getBlockedAccountMessage(user);
    if (blockedMessage) {
      throw new HttpError(401, blockedMessage, {
        error_type: blockedMessage === ACCOUNT_DELETED_MESSAGE ? 'account_deleted' : 'account_blocked'
      });
    }

    const payloadTokenVersion = Number(payload.tokenVersion || 0);
    const userTokenVersion = Number(user.token_version || 0);
    if (payloadTokenVersion !== userTokenVersion) {
      throw new HttpError(
        401,
        'You have been signed in on another device. Please log in again.',
        { error_type: 'session_invalidated' }
      );
    }

    req.auth = { userId: payload.userId, role: payload.role };
    return next();
  } catch (err) {
    if (err instanceof HttpError && err.message === ACCOUNT_DELETED_MESSAGE) {
      return next(err);
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { logger } = require('../config/logger');
        let reason = 'unknown';
        if (err?.name === 'TokenExpiredError') reason = 'token_expired';
        else if (err?.name === 'JsonWebTokenError') reason = 'invalid_token';
        else if (err instanceof HttpError) reason = err.message;
        logger.debug('auth_middleware_rejected', {
          path: req.originalUrl,
          method: req.method,
          reason,
          hasAuthHeader: Boolean(req.headers.authorization),
        });
      } catch (_) {}
    }
    return next(new HttpError(401, 'Unauthorized'));
  }
}

module.exports = { authMiddleware };

