const { Op } = require('sequelize');
const db = require('../models');
const { logger } = require('../config/logger');

const ENGAGEMENT_KINDS = new Set([
  'message.push.clicked',
  'message.push.received',
  'message.push.sent',
  'message.push.failed',
  'message.email.opened',
  'message.email.clicked',
  'message.email.received',
  'message.email.sent',
  'message.email.failed',
]);

function parseMaybeJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  const s = String(value).trim();
  if (!s || s === '{}') return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Normalize OneSignal Event Stream payloads (flat Liquid keys or nested objects).
 */
function normalizeOnesignalEvent(body) {
  const raw = body && typeof body === 'object' ? body : {};

  const nestedEvent = raw.event && typeof raw.event === 'object' ? raw.event : null;
  const nestedMessage = raw.message && typeof raw.message === 'object' ? raw.message : null;

  const kind =
    nestedEvent?.kind ||
    raw['event.kind'] ||
    raw.kind ||
    raw.event_kind ||
    null;

  const eventId =
    nestedEvent?.id ||
    raw['event.id'] ||
    raw.event_id ||
    null;

  const occurredAt =
    nestedEvent?.datetime ||
    raw['event.datetime'] ||
    (raw['event.timestamp'] ? new Date(Number(raw['event.timestamp']) * 1000).toISOString() : null) ||
    (nestedEvent?.timestamp ? new Date(Number(nestedEvent.timestamp) * 1000).toISOString() : null) ||
    new Date().toISOString();

  const externalId =
    nestedEvent?.external_id ||
    raw['event.external_id'] ||
    raw.external_id ||
    raw.user?.external_id ||
    raw['user.external_id'] ||
    null;

  const subscriptionId =
    nestedEvent?.subscription_id ||
    raw['event.subscription_id'] ||
    null;

  const deviceType =
    nestedEvent?.subscription_device_type ||
    raw['event.subscription_device_type'] ||
    null;

  const messageId =
    nestedMessage?.id ||
    raw['message.id'] ||
    raw.message_id ||
    null;

  const messageData = parseMaybeJson(
    nestedMessage?.data ?? nestedMessage?.custom_data ?? raw['message.data'] ?? raw['message.custom_data']
  );

  const failureReason =
    nestedEvent?.data?.failure_reason ||
    raw['event.data.failure_reason'] ||
    raw.failure_reason ||
    null;

  return {
    kind: kind ? String(kind) : null,
    eventId: eventId ? String(eventId) : null,
    occurredAt: new Date(occurredAt),
    externalId: externalId != null && externalId !== '' ? String(externalId) : null,
    subscriptionId: subscriptionId ? String(subscriptionId) : null,
    deviceType: deviceType ? String(deviceType) : null,
    messageId: messageId ? String(messageId) : null,
    messageData,
    failureReason: failureReason ? String(failureReason) : null,
    raw,
  };
}

async function findDeliveryLog(normalized) {
  const { messageData, messageId, externalId } = normalized;
  const deliveryLogId = Number(messageData.delivery_log_id);
  if (deliveryLogId) {
    const byId = await db.NotificationDeliveryLog.findByPk(deliveryLogId);
    if (byId) return byId;
  }

  if (messageId) {
    const byOsId = await db.NotificationDeliveryLog.findOne({
      where: { onesignal_notification_id: messageId },
      order: [['created_at', 'DESC']],
    });
    if (byOsId) return byOsId;
  }

  const recipientId = Number(messageData.user_id || externalId);
  const campaignId = Number(messageData.campaign_id);
  if (recipientId && campaignId) {
    const channel = normalized.kind?.startsWith('message.email') ? 'email' : 'push';
    const byCampaign = await db.NotificationDeliveryLog.findOne({
      where: {
        recipient_id: recipientId,
        campaign_id: campaignId,
        channel,
      },
      order: [['created_at', 'DESC']],
    });
    if (byCampaign) return byCampaign;
  }

  if (recipientId && messageId) {
    const byRecipient = await db.NotificationDeliveryLog.findOne({
      where: {
        recipient_id: recipientId,
        [Op.or]: [
          { onesignal_notification_id: messageId },
          { meta: { [Op.like]: `%${messageId}%` } },
        ],
      },
      order: [['created_at', 'DESC']],
    });
    if (byRecipient) return byRecipient;
  }

  return null;
}

function mergeMeta(log, patch) {
  return { ...(log.meta && typeof log.meta === 'object' ? log.meta : {}), ...patch };
}

/**
 * Apply engagement event to a delivery log row (idempotent per event.id).
 */
async function applyEventToDeliveryLog(log, normalized) {
  const { kind, eventId, occurredAt, subscriptionId, deviceType, messageId, failureReason } =
    normalized;

  const meta = log.meta && typeof log.meta === 'object' ? { ...log.meta } : {};
  const processed = new Set(Array.isArray(meta.processed_onesignal_event_ids) ? meta.processed_onesignal_event_ids : []);
  if (eventId && processed.has(eventId)) {
    return { updated: false, duplicate: true, logId: log.id };
  }
  if (eventId) processed.add(eventId);

  const updates = {
    meta: mergeMeta(log, {
      processed_onesignal_event_ids: [...processed].slice(-200),
      last_onesignal_event: {
        kind,
        event_id: eventId,
        at: occurredAt.toISOString(),
        subscription_id: subscriptionId,
        device_type: deviceType,
      },
    }),
  };

  if (messageId && !log.onesignal_notification_id) {
    updates.onesignal_notification_id = messageId;
  }
  if (subscriptionId && !log.device_token) {
    updates.device_token = subscriptionId;
  }

  switch (kind) {
    case 'message.push.sent':
    case 'message.push.received':
    case 'message.email.received':
    case 'message.email.sent':
      if (!log.delivered_at) {
        updates.delivered_at = occurredAt;
        updates.delivery_status = 'delivered';
      }
      break;

    case 'message.push.clicked':
      updates.opened_at = log.opened_at || occurredAt;
      updates.clicked_at = occurredAt;
      updates.delivery_status = 'clicked';
      if (!log.delivered_at) updates.delivered_at = occurredAt;
      break;

    case 'message.email.opened':
      updates.opened_at = occurredAt;
      if (log.delivery_status !== 'clicked') {
        updates.delivery_status = 'opened';
      }
      if (!log.delivered_at) updates.delivered_at = occurredAt;
      break;

    case 'message.email.clicked':
      updates.opened_at = log.opened_at || occurredAt;
      updates.clicked_at = occurredAt;
      updates.delivery_status = 'clicked';
      if (!log.delivered_at) updates.delivered_at = occurredAt;
      break;

    case 'message.push.failed':
    case 'message.email.failed':
      updates.delivery_status = 'failed';
      updates.failure_reason = failureReason || log.failure_reason || 'OneSignal reported delivery failure';
      break;

    default:
      return { updated: false, skipped: true, reason: 'unhandled_kind', logId: log.id };
  }

  await log.update(updates);
  return { updated: true, logId: log.id, kind };
}

async function processOnesignalWebhook(body) {
  const normalized = normalizeOnesignalEvent(body);

  if (!normalized.kind) {
    logger.debug('onesignal_webhook_missing_kind', { keys: Object.keys(body || {}) });
    return { ok: true, handled: false, reason: 'missing_kind' };
  }

  if (!ENGAGEMENT_KINDS.has(normalized.kind)) {
    logger.debug('onesignal_webhook_ignored_kind', { kind: normalized.kind });
    return { ok: true, handled: false, reason: 'ignored_kind', kind: normalized.kind };
  }

  const log = await findDeliveryLog(normalized);
  if (!log) {
    logger.info('onesignal_webhook_no_delivery_log', {
      kind: normalized.kind,
      messageId: normalized.messageId,
      externalId: normalized.externalId,
    });
    return { ok: true, handled: false, reason: 'log_not_found', kind: normalized.kind };
  }

  const result = await applyEventToDeliveryLog(log, normalized);
  logger.info('onesignal_webhook_applied', {
    kind: normalized.kind,
    logId: log.id,
    ...result,
  });

  return { ok: true, handled: true, ...result, kind: normalized.kind };
}

module.exports = {
  normalizeOnesignalEvent,
  findDeliveryLog,
  applyEventToDeliveryLog,
  processOnesignalWebhook,
  ENGAGEMENT_KINDS,
};
