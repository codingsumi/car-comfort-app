const crypto = require('crypto');
const db = require('../../models');
const { logger } = require('../../config/logger');
const { sendPushToUser } = require('./push.provider');
const { ensureInboxNotification } = require('./inboxNotification.service');
const { sendEmail } = require('../../services/email.service');
const { generateEmailTemplate } = require('../../../utils/emailTemplate');
const { renderTemplate } = require('./templateRender.service');

async function createDeliveryLog({
  campaignId,
  recipientId,
  channel,
  status,
  failureReason,
  deviceToken,
  meta,
  notificationId,
  onesignalNotificationId,
}) {
  const now = new Date();
  const deliveredAt = status === 'delivered' || status === 'opened' || status === 'clicked' ? now : null;
  return db.NotificationDeliveryLog.create({
    campaign_id: campaignId || null,
    notification_id: notificationId || null,
    recipient_id: recipientId,
    channel,
    delivery_status: status,
    delivered_at: deliveredAt,
    failure_reason: failureReason || null,
    device_token: deviceToken || null,
    onesignal_notification_id: onesignalNotificationId || null,
    meta: meta || null,
  });
}

async function deliverToUser({
  campaign,
  userId,
  title,
  message,
  channels,
  variables,
}) {
  const uid = Number(userId);
  const campaignId = campaign?.id || null;
  const results = [];

  const user = await db.User.findByPk(uid, {
    attributes: ['id', 'name', 'email', 'role'],
  });
  if (!user) {
    return { userId: uid, skipped: true, reason: 'user_not_found' };
  }

  const mergedVars = {
    customer_name: user.role === 'customer' ? user.name : variables?.customer_name || '',
    provider_name: user.role === 'driver' ? user.name : variables?.provider_name || '',
    ...variables,
  };
  const renderedTitle = renderTemplate(title, mergedVars);
  const renderedMessage = renderTemplate(message, mergedVars);

  const deliveryKey = campaignId
    ? `campaign:${campaignId}:user:${uid}`
    : `admin-send:${crypto.createHash('sha256').update(`${uid}:${renderedTitle}:${Date.now()}`).digest('hex').slice(0, 32)}`;

  const payloadData = {
    kind: campaign?.notification_type || 'ADMIN_CAMPAIGN',
    campaign_id: campaignId ? String(campaignId) : undefined,
    deep_link_url: campaign?.deep_link_url || undefined,
    cta_url: campaign?.cta_url || undefined,
    image_url: campaign?.image_url || undefined,
  };

  for (const channel of channels) {
    try {
      if (channel === 'push') {
        const pushLog = await createDeliveryLog({
          campaignId,
          recipientId: uid,
          channel: 'push',
          status: 'pending',
        });

        const pushData = {
          ...payloadData,
          delivery_log_id: String(pushLog.id),
          user_id: String(uid),
        };

        const pushResult = await sendPushToUser(uid, {
          title: renderedTitle,
          body: renderedMessage,
          data: pushData,
          idempotencyKey: `${deliveryKey}:push`,
        });

        const onesignalNotificationId = pushResult?.onesignalId || pushResult?.raw?.id || null;

        if (pushResult?.skipped) {
          await pushLog.update({
            delivery_status: 'skipped',
            failure_reason: pushResult.reason,
            meta: pushResult,
          });
        } else {
          await pushLog.update({
            delivery_status: 'delivered',
            delivered_at: new Date(),
            onesignal_notification_id: onesignalNotificationId,
            meta: pushResult,
          });
        }
        results.push({ channel: 'push', ok: !pushResult?.skipped, result: pushResult });
        continue;
      }

      if (channel === 'in_app') {
        const inbox = await ensureInboxNotification({
          userId: uid,
          bookingId: null,
          notificationType: campaign?.notification_type || 'ADMIN_CAMPAIGN',
          deliveryKey: `${deliveryKey}:inbox`,
          title: renderedTitle,
          message: renderedMessage,
          data: payloadData,
        });
        await inbox.update({ sent_status: 'delivered' });
        await createDeliveryLog({
          campaignId,
          recipientId: uid,
          channel: 'in_app',
          status: 'delivered',
          notificationId: inbox?.id,
        });
        results.push({ channel: 'in_app', ok: true });
        continue;
      }

      if (channel === 'email') {
        if (!user.email) {
          await createDeliveryLog({
            campaignId,
            recipientId: uid,
            channel: 'email',
            status: 'skipped',
            failureReason: 'no_email',
          });
          results.push({ channel: 'email', ok: false, reason: 'no_email' });
          continue;
        }
        const html = generateEmailTemplate({
          title: renderedTitle,
          message: renderedMessage,
          buttonText: campaign?.cta_text,
          buttonLink: campaign?.cta_url,
        });
        const emailResult = await sendEmail({
          to: user.email,
          subject: renderedTitle,
          text: renderedMessage,
          html,
        });
        await createDeliveryLog({
          campaignId,
          recipientId: uid,
          channel: 'email',
          status: emailResult?.rejected?.length ? 'failed' : 'delivered',
          failureReason: emailResult?.rejected?.length ? 'rejected' : null,
          meta: emailResult,
        });
        results.push({ channel: 'email', ok: !emailResult?.rejected?.length });
      }
    } catch (err) {
      logger.error('campaign_delivery_channel_failed', {
        userId: uid,
        channel,
        message: err?.message,
      });
      await createDeliveryLog({
        campaignId,
        recipientId: uid,
        channel,
        status: 'failed',
        failureReason: err?.message,
      });
      results.push({ channel, ok: false, error: err?.message });
    }
  }

  return { userId: uid, results };
}

module.exports = { deliverToUser, createDeliveryLog };
