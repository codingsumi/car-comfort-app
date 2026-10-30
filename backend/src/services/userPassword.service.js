const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { HttpError } = require('../utils/httpError');

const MIN_PASSWORD_LENGTH = 8;

function generateSystemPassword() {
  const segment = crypto.randomBytes(4).toString('hex');
  return `Cc${segment}1!`;
}

function validatePassword(plain) {
  const value = typeof plain === 'string' ? plain.trim() : '';
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return value;
}

async function hashPassword(plain) {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  return bcrypt.hash(plain, saltRounds);
}

async function setUserPassword(user, plainPassword, { invalidateSessions = true } = {}) {
  const plain = validatePassword(plainPassword);
  const hashed = await hashPassword(plain);
  const update = { password: hashed };
  if (invalidateSessions) {
    update.token_version = (user.token_version || 0) + 1;
  }
  await user.update(update);
  return plain;
}

async function assignSystemPassword(user, options = {}) {
  const plain = generateSystemPassword();
  await setUserPassword(user, plain, options);
  return plain;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  generateSystemPassword,
  validatePassword,
  hashPassword,
  setUserPassword,
  assignSystemPassword,
};
