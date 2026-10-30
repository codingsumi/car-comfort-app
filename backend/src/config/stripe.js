const Stripe = require('stripe');

let cached = null;
let cachedKey = null;

/** Emails that must use per-user test Stripe keys. */
const EMAIL_TEST_KEY_USERS = new Set([
  'shefali.kushwaha@skyestoneai.com',
  'driver3@knoxweb.us',
]);

function getStripeClient(secretKey) {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error('STRIPE_SECRET_KEY is not configured');
    err.code = 'stripe_key_missing';
    throw err;
  }

  if (cached && cachedKey === key) return cached;

  cached = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia',
    appInfo: { name: 'car-comfort', version: '1.0.0' },
  });
  cachedKey = key;

  return cached;
}

async function getStripeClientFromSettings(db) {
  const { getStripeConfig } = require('../services/settingsRuntime.service');
  const config = await getStripeConfig(db);
  if (!config.secretKey) {
    const err = new Error('Stripe secret key is not configured');
    err.status = 503;
    throw err;
  }
  return getStripeClient(config.secretKey);
}

/**
 * Get a Stripe client for a specific user. Checks the user's per-user
 * test keys first (for the allow-listed emails), then falls back to
 * the global DB keys.
 */
async function getStripeForUser(userId) {
  const User = require('../models').User;
  const user = await User.findByPk(userId, {
    attributes: ['email', 'stripe_test_secret_key'],
  });
  if (!user) {
    const globalStripe = await getStripe();
    return globalStripe;
  }

  const userEmail = String(user.email || '').trim().toLowerCase();
  const perUserSecretKey = String(user.stripe_test_secret_key || '').trim();

  // Use per-user test keys if this email is in the allow-list
  if (EMAIL_TEST_KEY_USERS.has(userEmail) && perUserSecretKey) {
    if (cached && cachedKey === perUserSecretKey) return cached;
    cached = new Stripe(perUserSecretKey, {
      apiVersion: '2026-03-25.dahlia',
      appInfo: { name: 'car-comfort', version: '1.0.0' },
    });
    cachedKey = perUserSecretKey;
    return cached;
  }

  // Fall back to global keys
  return getStripe();
}

/** Preferred entry: admin DB settings with env fallback. */
async function getStripe() {
  const db = require('../models');
  return getStripeClientFromSettings(db);
}

function invalidateStripeClient() {
  cached = null;
  cachedKey = null;
}

module.exports = {
  getStripeClient,
  getStripeClientFromSettings,
  getStripeForUser,
  getStripe,
  invalidateStripeClient,
};

