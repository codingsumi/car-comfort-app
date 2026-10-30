const { getSettingByKey } = require('./settings.service');
const { decrypt } = require('../utils/encryption');
const { logger } = require('../config/logger');

function isValidStripeSecretKey(value) {
  return typeof value === 'string' && /^sk_(test|live)_[A-Za-z0-9]+$/.test(value.trim());
}

function isValidStripePublishableKey(value) {
  return typeof value === 'string' && /^pk_(test|live)_[A-Za-z0-9]+$/.test(value.trim());
}

/**
 * Resolve a setting value: DB first (decrypted if sensitive), then env fallback.
 * Optional `validate` rejects invalid DB values so env can be used instead.
 */
async function resolveSetting(db, key, envKey, validate) {
  let fromDb = null;
  try {
    const setting = await getSettingByKey(db, key);
    if (setting?.value) fromDb = String(setting.value).trim();
  } catch {
    // fall through to env
  }

  if (fromDb && typeof validate === 'function' && !validate(fromDb)) {
    logger.warn('settings_resolve_invalid_db_value', { key, source: 'database', fallback: envKey || null });
    fromDb = null;
  }

  if (fromDb) return fromDb;
  const fromEnv = envKey ? process.env[envKey] || null : null;
  return fromEnv ? String(fromEnv).trim() : null;
}

async function getStripeConfig(db) {
  const paymentMode = await resolveSetting(db, 'stripe_payment_mode', null) || 'test';
  const isLive = paymentMode === 'live';

  // Mode-specific DB fields (primary source)
  const pkDbKey = isLive ? 'stripe_publishable_key_live' : 'stripe_publishable_key_test';
  const skDbKey = isLive ? 'stripe_secret_key_live'      : 'stripe_secret_key_test';

  // Publishable key: DB mode-specific field → env fallback
  let publishableKey = await resolveSetting(db, pkDbKey, null, isValidStripePublishableKey);
  if (!publishableKey) {
    // .env fallback — accept only if prefix matches current mode
    const envPk = (process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || '').trim();
    if (envPk && envPk.includes(`pk_${paymentMode}_`) && isValidStripePublishableKey(envPk)) {
      publishableKey = envPk;
    }
  }

  // Secret key: DB mode-specific field → env fallback
  let secretKey = await resolveSetting(db, skDbKey, null, isValidStripeSecretKey);
  if (!secretKey) {
    const envSk = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (envSk && envSk.includes(`sk_${paymentMode}_`) && isValidStripeSecretKey(envSk)) {
      secretKey = envSk;
    }
  }

  const webhookSecret = await resolveSetting(db, 'stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET');
  const connectedAccountsEnabled = await resolveSetting(db, 'stripe_connected_account_enabled', null);

  // Diagnostic log — shows mode, key types and sources without exposing key values
  logger.info('stripe_config_resolved', {
    mode: paymentMode,
    pk_db_key: pkDbKey,
    sk_db_key: skDbKey,
    pk_type: publishableKey
      ? (publishableKey.includes('pk_live_') ? 'live' : publishableKey.includes('pk_test_') ? 'test' : 'unknown')
      : 'MISSING',
    sk_type: secretKey
      ? (secretKey.includes('sk_live_') ? 'live' : secretKey.includes('sk_test_') ? 'test' : 'unknown')
      : 'MISSING',
    pk_source: publishableKey ? 'db_or_env' : 'none',
    sk_source: secretKey ? 'db_or_env' : 'none',
  });

  return {
    publishableKey,
    secretKey,
    webhookSecret,
    paymentMode,
    connectedAccountsEnabled: connectedAccountsEnabled === true || connectedAccountsEnabled === 'true',
  };
}

/**
 * Support contact details used on invoices, legal pages, and notifications.
 * Prefers General Settings (`support_email`, `contact_number`) with env
 * fallbacks so admins can manage contacts from the UI per environment.
 */
async function getSupportContact(db) {
  const supportEmail =
    (await resolveSetting(db, 'support_email', 'SUPPORT_EMAIL')) ||
    (await resolveSetting(db, 'smtp_from_email', 'MAIL_FROM_ADDRESS')) ||
    'support@carcomfort.com';

  const supportPhone =
    (await resolveSetting(db, 'contact_number', 'SUPPORT_PHONE')) ||
    '';

  return { supportEmail, supportPhone };
}

async function getSmtpConfig(db) {
  const host = await resolveSetting(db, 'smtp_host', 'MAIL_HOST');
  const port = await resolveSetting(db, 'smtp_port', 'MAIL_PORT');
  const username = await resolveSetting(db, 'smtp_username', 'MAIL_USERNAME');
  const password = await resolveSetting(db, 'smtp_password', 'MAIL_PASSWORD');
  const encryption = await resolveSetting(db, 'smtp_encryption', 'MAIL_ENCRYPTION');
  const fromEmail = await resolveSetting(db, 'smtp_from_email', 'MAIL_FROM_ADDRESS');
  const fromName = await resolveSetting(db, 'smtp_from_name', 'MAIL_FROM_NAME');

  return {
    host,
    port: port ? Number(port) : 587,
    username,
    password,
    encryption: encryption || 'tls',
    fromEmail,
    fromName,
  };
}

async function testStripeConnection(db) {
  const { secretKey } = await getStripeConfig(db);
  if (!secretKey) {
    const err = new Error('Stripe secret key is not configured');
    err.status = 400;
    throw err;
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-03-25.dahlia',
    appInfo: { name: 'car-comfort', version: '1.0.0' },
  });

  const balance = await stripe.balance.retrieve();
  return {
    connected: true,
    livemode: balance.livemode,
    available: balance.available?.map((b) => ({ currency: b.currency, amount: b.amount })) || [],
  };
}

async function testSmtpConnection(db, { to } = {}) {
  const nodemailer = require('nodemailer');
  const config = await getSmtpConfig(db);

  if (!config.host || !config.username || !config.password) {
    const err = new Error('SMTP is not fully configured');
    err.status = 400;
    throw err;
  }

  const port = config.port || 587;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: { user: config.username, pass: config.password },
    ...(config.encryption === 'tls' ? { requireTLS: true } : {}),
  });

  await transporter.verify();

  if (to) {
    const from = `${config.fromName || 'Car Comfort'} <${config.fromEmail || config.username}>`;
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Car Comfort — SMTP Test',
      text: 'This is a test email from Car Comfort admin settings.',
      html: '<p>This is a <strong>test email</strong> from Car Comfort admin settings.</p>',
    });
    return { verified: true, sent: true, messageId: info.messageId };
  }

  return { verified: true, sent: false };
}

module.exports = {
  resolveSetting,
  getStripeConfig,
  getSupportContact,
  getSmtpConfig,
  testStripeConnection,
  testSmtpConnection,
};
