const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { getStripeConfig } = require('../services/settingsRuntime.service');
const { logger } = require('../config/logger');
const {
  addCardAndSetDefault,
  listCards,
  createCustomerSetupIntent,
  setDefaultCard,
  removeCard
} = require('../services/stripe.service');

async function getUserOrThrow(req) {
  const userId = req.auth?.userId;
  if (!userId) throw new HttpError(401, 'Unauthorized');

  const user = await db.User.findByPk(userId);
  if (!user) throw new HttpError(401, 'Unauthorized');
  return user;
}

async function addCard(req, res, next) {
  try {
    const user = await getUserOrThrow(req);
    const payment_method_id = req.body.payment_method_id;

    const result = await addCardAndSetDefault({ user, payment_method_id });
    return res.success('Card added', result);
  } catch (err) {
    return next(err);
  }
}

async function createSetupIntent(req, res, next) {
  try {
    const user = await getUserOrThrow(req);
    const category = req.body?.category || 'card';
    const result = await createCustomerSetupIntent({ user, category });
    return res.success('Setup intent created', result);
  } catch (err) {
    return next(err);
  }
}

async function getCards(req, res, next) {
  try {
    const user = await getUserOrThrow(req);
    const result = await listCards({ user });
    return res.success('Payment methods fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function setDefault(req, res, next) {
  try {
    const user = await getUserOrThrow(req);
    const payment_method_id = req.body.payment_method_id;

    const result = await setDefaultCard({ user, payment_method_id });
    return res.success('Default card updated', result);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const user = await getUserOrThrow(req);
    const payment_method_id = req.params.id;

    const result = await removeCard({ user, payment_method_id });
    return res.success('Card removed', result);
  } catch (err) {
    return next(err);
  }
}

/**
 * Public Stripe client config (publishable key from admin settings).
 * @example GET /api/payments/stripe-config
 */
async function getStripeConfigPublic(req, res, next) {
  try {
    const config = await getStripeConfig(db);
    const publishableKey = config.publishableKey ? String(config.publishableKey).trim() : '';
    if (!publishableKey) {
      throw new HttpError(503, 'Stripe publishable key is not configured');
    }
    const mode = config.paymentMode || 'test';
    const pkPrefix = publishableKey.substring(0, 14);
    const pkSuffix = publishableKey.slice(-6);
    logger.info('stripe_config_served', {
      mode,
      pk_preview: `${pkPrefix}...${pkSuffix}`,
      pk_type: publishableKey.includes('pk_live_') ? 'live' : publishableKey.includes('pk_test_') ? 'test' : 'unknown',
      sk_type: config.secretKey
        ? (config.secretKey.includes('sk_live_') ? 'live' : config.secretKey.includes('sk_test_') ? 'test' : 'encrypted')
        : 'missing',
      ip: req.ip,
    });
    return res.success('Stripe config', {
      publishable_key: publishableKey,
      payment_mode: mode,
      connected_accounts_enabled: Boolean(config.connectedAccountsEnabled),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  addCard,
  getCards,
  setDefault,
  remove,
  getStripeConfigPublic,
  createSetupIntent,
};

