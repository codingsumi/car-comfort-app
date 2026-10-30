const OneSignal = require('@onesignal/node-onesignal');
const crypto = require('crypto');
const { loadOneSignalConfig, isOneSignalConfigured } = require('../../config/onesignal');
const { logger } = require('../../config/logger');

let _api;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 12) return '***';
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function maskIds(values) {
  return (values || []).map(maskSecret);
}

function serializeOneSignalError(err) {
  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    statusCode: err?.code || err?.statusCode || err?.response?.status,
    body: err?.body || err?.response?.body || err?.response?.data,
    stack: err?.stack
  };
}

function toDeterministicUuid(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (UUID_RE.test(raw)) return raw;

  const hex = crypto.createHash('sha256').update(raw).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32)
  ].join('-');
}

function getApi() {
  if (_api) return _api;
  if (!isOneSignalConfigured()) return null;
  const cfg = loadOneSignalConfig();
  const configuration = OneSignal.createConfiguration({
    restApiKey: cfg.restApiKey
  });
  _api = new OneSignal.DefaultApi(configuration);
  return _api;
}

/** OneSignal `data` payload values should be strings for broad client compatibility. */
function stringifyDataPayload(data) {
  if (!data || typeof data !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[String(k)] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Send a push to specific OneSignal subscription IDs (player / subscription id from mobile SDK).
 * Uses official @onesignal/node-onesignal client (no hand-rolled REST calls).
 */
async function sendOneSignalPushToSubscriptions({ subscriptionIds, title, body, data, idempotencyKey }) {
  const cfg = loadOneSignalConfig();
  const client = getApi();
  if (!client) {
    logger.error('onesignal_not_configured', {
      hasAppId: Boolean(cfg.appId),
      hasRestApiKey: Boolean(cfg.restApiKey),
      hasAndroidChannelId: Boolean(cfg.androidChannelId)
    });
    const err = new Error('OneSignal is not configured (missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)');
    err.code = 'ONESIGNAL_NOT_CONFIGURED';
    throw err;
  }

  const ids = [...new Set((subscriptionIds || []).map(String).filter(Boolean))];
  if (!ids.length) {
    return { skipped: true, reason: 'no_subscription_ids' };
  }

  const notification = new OneSignal.Notification();
  notification.app_id = cfg.appId;
  notification.include_subscription_ids = ids;
  notification.headings = { en: String(title || 'Car Comfort') };
  notification.contents = { en: String(body || '') };
  const flat = stringifyDataPayload(data);
  if (flat) notification.data = flat;
  if (cfg.androidChannelId) {
    notification.android_channel_id = cfg.androidChannelId;
  }
  const oneSignalIdempotencyKey = toDeterministicUuid(idempotencyKey);
  if (oneSignalIdempotencyKey) {
    notification.idempotency_key = oneSignalIdempotencyKey;
  }

  const requestPayload = {
    app_id: notification.app_id,
    include_subscription_ids: notification.include_subscription_ids,
    headings: notification.headings,
    contents: notification.contents,
    data: notification.data,
    android_channel_id: notification.android_channel_id,
    idempotency_key: notification.idempotency_key
  };

  logger.info('onesignal_create_notification_request', {
    headers: {
      Authorization: `Key ${maskSecret(cfg.restApiKey)}`,
      'Content-Type': 'application/json'
    },
    payload: {
      ...requestPayload,
      app_id: maskSecret(requestPayload.app_id),
      include_subscription_ids: maskIds(requestPayload.include_subscription_ids)
    },
    appIdempotencyKey: idempotencyKey,
    oneSignalIdempotencyKey,
    targetSubscriptionCount: ids.length
  });

  try {
    const response = await client.createNotification(notification);
    logger.info('onesignal_create_notification_response', {
      response,
      targetSubscriptionCount: ids.length,
      idempotencyKey: notification.idempotency_key
    });
    return { onesignalId: response?.id, subscriptionCount: ids.length, raw: response };
  } catch (err) {
    logger.error('onesignal_create_notification_failed', {
      error: serializeOneSignalError(err),
      payload: {
        ...requestPayload,
        app_id: maskSecret(requestPayload.app_id),
        include_subscription_ids: maskIds(requestPayload.include_subscription_ids)
      }
    });
    throw err;
  }
}

module.exports = { sendOneSignalPushToSubscriptions, stringifyDataPayload };
