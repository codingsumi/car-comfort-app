const jwt = require('jsonwebtoken');

function signAuthToken({ userId, role, tokenVersion = 0, sessionId = null }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not configured');
    err.statusCode = 500;
    throw err;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const payload = { userId, role, tokenVersion };
  if (sessionId) payload.sessionId = sessionId;
  return jwt.sign(payload, secret, { expiresIn });
}

function signResetToken({ userId }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not configured');
    err.statusCode = 500;
    throw err;
  }

  const expiresIn = process.env.RESET_TOKEN_EXPIRES_IN || '15m';
  return jwt.sign({ userId, purpose: 'password_reset' }, secret, { expiresIn });
}

function verifyResetToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET is not configured');
    err.statusCode = 500;
    throw err;
  }

  const payload = jwt.verify(token, secret);
  if (payload?.purpose !== 'password_reset' || !payload?.userId) {
    const err = new Error('Invalid reset token');
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

module.exports = { signAuthToken, signResetToken, verifyResetToken };

