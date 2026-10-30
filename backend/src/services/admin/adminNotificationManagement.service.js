const { Op, fn, col } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { resolveAudienceUserIds } = require('../../modules/notifications/audienceResolver.service');
const { deliverToUser } = require('../../modules/notifications/campaignDelivery.service');
const { renderTemplate } = require('../../modules/notifications/templateRender.service');
const { logger } = require('../../config/logger');
const {
  addCampaignBatchJob,
  addCampaignSendJob,
  removeCampaignSendJob,
} = require('../../modules/queues/notification.queue');
const { shouldEmbedNotificationWorker } = require('../../modules/configs/notification.config');

const BATCH_SIZE = 50;

function shouldProcessCampaignsInline() {
  if (process.env.NOTIFICATION_INLINE_DELIVERY === 'true') return true;
  if (process.env.NOTIFICATION_INLINE_DELIVERY === 'false') return false;
  return !shouldEmbedNotificationWorker();
}

async function deliverCampaignBatchesInline(campaignId, userIds) {
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await processCampaignBatch({ campaignId, userIds: batch });
  }
}

function classifyRecipientOutcome(channelResults = []) {
  if (!channelResults.length) return 'failed';
  if (channelResults.some((r) => r.ok)) return 'sent';
  const onlySkipped = channelResults.every(
    (r) => r.result?.skipped || r.reason === 'no_email' || r.reason === 'no_active_devices'
  );
  return onlySkipped ? 'skipped' : 'failed';
}

function resolveCampaignFinalStatus(stats) {
  const sent = Number(stats.sent || 0);
  const failed = Number(stats.failed || 0);
  const skipped = Number(stats.skipped || 0);
  if (failed > 0 && sent === 0 && skipped === 0) return 'failed';
  return 'sent';
}

async function scheduleCampaignSendJob(campaignId, scheduledAt) {
  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || !Number.isFinite(when.getTime())) return { scheduled: false };
  await removeCampaignSendJob(campaignId);
  const delayMs = Math.max(0, when.getTime() - Date.now());
  await addCampaignSendJob({ campaignId }, { delayMs });
  return { scheduled: true, delayMs };
}

async function writeAudit(adminId, actionType, entityType, entityId, details, ip) {
  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: ip || null,
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getDashboard() {
  const today = startOfToday();

  const sentToday = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: today }, delivery_status: { [Op.in]: ['delivered', 'opened', 'clicked'] } },
  });

  const totalDelivered = await db.NotificationDeliveryLog.count({
    where: { delivery_status: { [Op.in]: ['delivered', 'opened', 'clicked'] } },
  });
  const totalFailed = await db.NotificationDeliveryLog.count({
    where: { delivery_status: 'failed' },
  });
  const totalAttempts = totalDelivered + totalFailed;
  const pushDeliveryRate = totalAttempts ? Math.round((totalDelivered / totalAttempts) * 100) : 0;

  const opened = await db.NotificationDeliveryLog.count({
    where: { delivery_status: { [Op.in]: ['opened', 'clicked'] } },
  });
  const openRate = totalDelivered ? Math.round((opened / totalDelivered) * 100) : 0;

  const failedToday = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: today }, delivery_status: 'failed' },
  });

  const scheduledCampaigns = await db.NotificationCampaign.count({ where: { status: 'scheduled' } });
  const activeCampaigns = await db.NotificationCampaign.count({
    where: { status: { [Op.in]: ['scheduled', 'sending'] } },
  });

  const emailDelivered = await db.NotificationDeliveryLog.count({
    where: { channel: 'email', delivery_status: 'delivered' },
  });
  const emailFailed = await db.NotificationDeliveryLog.count({
    where: { channel: 'email', delivery_status: 'failed' },
  });
  const emailTotal = emailDelivered + emailFailed;
  const emailSuccessRate = emailTotal ? Math.round((emailDelivered / emailTotal) * 100) : 0;

  const recentCampaigns = await db.NotificationCampaign.findAll({
    limit: 8,
    order: [['created_at', 'DESC']],
    include: [{ model: db.User, as: 'creator', attributes: ['id', 'name', 'email'] }],
  });

  const failedDeliveries = await db.NotificationDeliveryLog.findAll({
    where: { delivery_status: 'failed' },
    limit: 10,
    order: [['created_at', 'DESC']],
    include: [
      { model: db.User, as: 'recipient', attributes: ['id', 'name', 'email'] },
      { model: db.NotificationCampaign, as: 'campaign', attributes: ['id', 'campaign_name'] },
    ],
  });

  const recentlyOpened = await db.NotificationDeliveryLog.findAll({
    where: { opened_at: { [Op.ne]: null } },
    limit: 10,
    order: [['opened_at', 'DESC']],
    include: [{ model: db.User, as: 'recipient', attributes: ['id', 'name', 'email'] }],
  });

  const scheduledNotifications = await db.NotificationCampaign.findAll({
    where: { status: 'scheduled', scheduled_at: { [Op.ne]: null } },
    limit: 10,
    order: [['scheduled_at', 'ASC']],
    include: [{ model: db.User, as: 'creator', attributes: ['id', 'name'] }],
  });

  return {
    summary: {
      sentToday,
      pushDeliveryRate,
      openRate,
      failedToday,
      scheduledCampaigns,
      activeCampaigns,
      emailSuccessRate,
    },
    recentCampaigns,
    failedDeliveries,
    recentlyOpened,
    scheduledNotifications,
  };
}

async function sendNotification(adminId, body, ip) {
  const channels = Array.isArray(body.channels) ? body.channels : ['push'];
  if (!channels.length) throw new HttpError(400, 'At least one channel is required');

  const audienceFilters = body.audience_filters || { segment: body.segment || 'all_customers' };
  const userIds = await resolveAudienceUserIds(audienceFilters);
  if (!userIds.length) throw new HttpError(400, 'No recipients match the selected audience');

  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
  const isFutureSchedule =
    scheduledAt && Number.isFinite(scheduledAt.getTime()) && scheduledAt > new Date();

  const campaign = await db.NotificationCampaign.create({
    campaign_name: body.campaign_name || `Send ${new Date().toISOString()}`,
    notification_type: body.notification_type || 'promotional',
    title: body.title,
    message: body.message,
    image_url: body.image_url || null,
    deep_link_url: body.deep_link_url || null,
    cta_text: body.cta_text || null,
    cta_url: body.cta_url || null,
    channels,
    audience_filters: audienceFilters,
    status: isFutureSchedule ? 'scheduled' : 'sending',
    timezone: body.timezone || 'UTC',
    scheduled_at: scheduledAt,
    recurring_rule: body.recurring_rule || null,
    template_id: body.template_id || null,
    created_by: adminId,
    delivery_stats: {
      audience_size: userIds.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      batches_total: 0,
      batches_done: 0,
    },
  });

  await writeAudit(adminId, 'notification_send', 'notification_campaign', campaign.id, { audience_size: userIds.length }, ip);

  if (isFutureSchedule) {
    await scheduleCampaignSendJob(campaign.id, scheduledAt);
    return { campaign, scheduled: true, audience_size: userIds.length };
  }

  await queueCampaignDelivery(campaign.id, userIds);
  return { campaign, scheduled: false, audience_size: userIds.length };
}

async function queueCampaignDelivery(
  campaignId,
  userIds,
  { batchKey = '0', preserveAudienceSize = false } = {}
) {
  const batchCount = Math.max(1, Math.ceil(userIds.length / BATCH_SIZE));
  const campaign = await db.NotificationCampaign.findByPk(campaignId);
  if (!campaign) return;

  const stats = campaign.delivery_stats || {};
  await campaign.update({
    status: 'sending',
    delivery_stats: {
      ...stats,
      audience_size: preserveAudienceSize
        ? (stats.audience_size || userIds.length)
        : userIds.length,
      sent: stats.sent || 0,
      failed: stats.failed || 0,
      skipped: stats.skipped || 0,
      batches_total: batchCount,
      batches_done: 0,
    },
  });

  if (shouldProcessCampaignsInline()) {
    logger.info('campaign_delivery_inline', { campaignId, recipients: userIds.length });
    await deliverCampaignBatchesInline(campaignId, userIds);
    return;
  }

  try {
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await addCampaignBatchJob(
        {
          campaignId,
          userIds: batch,
          offset: i,
        },
        { batchKey }
      );
    }
  } catch (err) {
    logger.error('campaign_queue_enqueue_failed_inline_fallback', {
      campaignId,
      message: err?.message,
    });
    await deliverCampaignBatchesInline(campaignId, userIds);
  }
}

async function processCampaignBatch({ campaignId, userIds }) {
  const precheck = await db.NotificationCampaign.findByPk(campaignId);
  if (!precheck || precheck.status === 'cancelled') return { skipped: true };

  const channels = Array.isArray(precheck.channels) ? precheck.channels : ['push'];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const result = await deliverToUser({
      campaign: precheck,
      userId,
      title: precheck.title,
      message: precheck.message,
      channels,
      variables: {},
    });
    if (result.skipped && result.reason === 'user_not_found') {
      failed += 1;
      continue;
    }
    const outcome = classifyRecipientOutcome(result.results || []);
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'skipped') skipped += 1;
    else failed += 1;
  }

  const t = await db.sequelize.transaction();
  try {
    const campaign = await db.NotificationCampaign.findByPk(campaignId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!campaign || campaign.status === 'cancelled') {
      await t.commit();
      return { skipped: true };
    }

    if (campaign.status === 'scheduled' || campaign.status === 'draft') {
      await campaign.update({ status: 'sending' }, { transaction: t });
    }

    const stats = campaign.delivery_stats || {};
    const nextStats = {
      audience_size: stats.audience_size || userIds.length,
      sent: (stats.sent || 0) + sent,
      failed: (stats.failed || 0) + failed,
      skipped: (stats.skipped || 0) + skipped,
      batches_total: stats.batches_total || 1,
      batches_done: (stats.batches_done || 0) + 1,
    };

    const batchesComplete = nextStats.batches_done >= nextStats.batches_total;
    const recipientsComplete =
      nextStats.sent + nextStats.failed + nextStats.skipped >= (nextStats.audience_size || 0);
    const isComplete = batchesComplete || recipientsComplete;

    await campaign.update(
      {
        delivery_stats: nextStats,
        ...(isComplete
          ? {
              status: resolveCampaignFinalStatus(nextStats),
              sent_at: new Date(),
            }
          : {}),
      },
      { transaction: t }
    );
    await t.commit();
    return { sent, failed, skipped, isComplete };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listCampaigns(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.campaign_name = { [Op.like]: `%${query.search}%` };
  }

  const { count, rows } = await db.NotificationCampaign.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'creator', attributes: ['id', 'name', 'email'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return { rows, count, totalPages: Math.ceil(count / limit), currentPage: page };
}

async function getCampaign(id) {
  const campaign = await db.NotificationCampaign.findByPk(id, {
    include: [
      { model: db.User, as: 'creator', attributes: ['id', 'name', 'email'] },
      { model: db.NotificationTemplate, as: 'template' },
    ],
  });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  return campaign;
}

async function createCampaign(adminId, body, ip) {
  const audienceFilters = body.audience_filters || { segment: 'all_customers' };
  const userIds = await resolveAudienceUserIds(audienceFilters);

  const campaign = await db.NotificationCampaign.create({
    campaign_name: body.campaign_name,
    notification_type: body.notification_type || 'promotional',
    title: body.title,
    message: body.message,
    image_url: body.image_url || null,
    deep_link_url: body.deep_link_url || null,
    cta_text: body.cta_text || null,
    cta_url: body.cta_url || null,
    channels: body.channels || ['push'],
    audience_filters: audienceFilters,
    status: body.status || 'draft',
    timezone: body.timezone || 'UTC',
    scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
    recurring_rule: body.recurring_rule || null,
    template_id: body.template_id || null,
    created_by: adminId,
    delivery_stats: {
      audience_size: userIds.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      batches_total: 0,
      batches_done: 0,
    },
  });

  await writeAudit(adminId, 'campaign_create', 'notification_campaign', campaign.id, {}, ip);

  if (body.status === 'scheduled' && body.scheduled_at) {
    const when = new Date(body.scheduled_at);
    if (when > new Date()) {
      await scheduleCampaignSendJob(campaign.id, when);
    } else {
      await queueCampaignDelivery(campaign.id, userIds);
    }
  }

  return campaign;
}

async function updateCampaign(adminId, id, body, ip) {
  const campaign = await getCampaign(id);
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    throw new HttpError(400, 'Only draft or scheduled campaigns can be edited');
  }

  const updates = {};
  const fields = [
    'campaign_name', 'notification_type', 'title', 'message', 'image_url',
    'deep_link_url', 'cta_text', 'cta_url', 'channels', 'audience_filters',
    'timezone', 'scheduled_at', 'recurring_rule', 'template_id', 'status',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (updates.scheduled_at) updates.scheduled_at = new Date(updates.scheduled_at);
  if (updates.audience_filters) {
    const userIds = await resolveAudienceUserIds(updates.audience_filters);
    updates.delivery_stats = { ...(campaign.delivery_stats || {}), audience_size: userIds.length };
  }

  await campaign.update(updates);
  await campaign.reload();

  const nextStatus = campaign.status;
  const nextScheduledAt = campaign.scheduled_at;
  if (nextStatus === 'scheduled' && nextScheduledAt) {
    const when = new Date(nextScheduledAt);
    if (when > new Date()) {
      await scheduleCampaignSendJob(campaign.id, when);
    } else {
      const userIds = await resolveAudienceUserIds(campaign.audience_filters);
      if (!userIds.length) throw new HttpError(400, 'No recipients match the selected audience');
      await queueCampaignDelivery(campaign.id, userIds);
    }
  } else if (nextStatus === 'draft') {
    await removeCampaignSendJob(campaign.id);
  }

  await writeAudit(adminId, 'campaign_update', 'notification_campaign', campaign.id, updates, ip);
  return campaign;
}

async function deleteCampaign(adminId, id, ip) {
  const campaign = await getCampaign(id);
  if (campaign.status === 'sending') throw new HttpError(400, 'Cannot delete a campaign that is sending');
  await removeCampaignSendJob(campaign.id);
  await campaign.update({ status: 'cancelled' });
  await writeAudit(adminId, 'campaign_cancel', 'notification_campaign', campaign.id, {}, ip);
  return campaign;
}

async function duplicateCampaign(adminId, id, ip) {
  const source = await getCampaign(id);
  const copy = await db.NotificationCampaign.create({
    campaign_name: `${source.campaign_name} (copy)`,
    notification_type: source.notification_type,
    title: source.title,
    message: source.message,
    image_url: source.image_url,
    deep_link_url: source.deep_link_url,
    cta_text: source.cta_text,
    cta_url: source.cta_url,
    channels: source.channels,
    audience_filters: source.audience_filters,
    status: 'draft',
    timezone: source.timezone,
    template_id: source.template_id,
    created_by: adminId,
    delivery_stats: {
      audience_size: source.delivery_stats?.audience_size || 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      batches_total: 0,
      batches_done: 0,
    },
  });
  await writeAudit(adminId, 'campaign_duplicate', 'notification_campaign', copy.id, { source_id: id }, ip);
  return copy;
}

async function retryCampaign(adminId, id, ip) {
  const campaign = await getCampaign(id);
  if (!['failed', 'sent', 'sending'].includes(campaign.status)) {
    throw new HttpError(400, 'Only failed, sent, or stuck sending campaigns can be retried');
  }

  let userIds = [];
  if (campaign.status === 'sending') {
    const allUserIds = await resolveAudienceUserIds(campaign.audience_filters);
    const touchedLogs = await db.NotificationDeliveryLog.findAll({
      where: {
        campaign_id: id,
        delivery_status: { [Op.in]: ['delivered', 'opened', 'clicked', 'skipped', 'failed'] },
      },
      attributes: ['recipient_id'],
      group: ['recipient_id'],
      raw: true,
    });
    const touched = new Set(touchedLogs.map((l) => Number(l.recipient_id)));
    userIds = allUserIds.filter((uid) => !touched.has(uid));
    if (!userIds.length) {
      const stats = campaign.delivery_stats || {};
      await campaign.update({
        status: resolveCampaignFinalStatus(stats),
        sent_at: campaign.sent_at || new Date(),
      });
      return { campaign, retried: 0, finalized: true };
    }
  } else {
    const failedLogs = await db.NotificationDeliveryLog.findAll({
      where: { campaign_id: id, delivery_status: 'failed' },
      attributes: ['recipient_id'],
      group: ['recipient_id'],
      raw: true,
    });
    userIds = failedLogs.map((l) => Number(l.recipient_id));
    if (!userIds.length) throw new HttpError(400, 'No failed deliveries to retry');
  }

  const priorStatus = campaign.status;
  const batchKey = String(Date.now());
  await campaign.update({ status: 'sending', sent_at: null });
  await queueCampaignDelivery(campaign.id, userIds, {
    batchKey,
    preserveAudienceSize: priorStatus === 'sending',
  });
  await writeAudit(adminId, 'campaign_retry', 'notification_campaign', campaign.id, { count: userIds.length }, ip);
  return { campaign, retried: userIds.length };
}

async function processScheduledCampaign(campaignId) {
  const campaign = await getCampaign(campaignId);
  if (campaign.status !== 'scheduled') return { skipped: true };
  const userIds = await resolveAudienceUserIds(campaign.audience_filters);
  if (!userIds.length) {
    await campaign.update({
      status: 'failed',
      delivery_stats: {
        audience_size: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        batches_total: 0,
        batches_done: 0,
      },
    });
    return { skipped: true, reason: 'no_recipients' };
  }
  await queueCampaignDelivery(campaign.id, userIds);
  return { queued: userIds.length };
}

// Templates
async function listTemplates(query) {
  const where = {};
  if (query.template_type) where.template_type = query.template_type;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;
  if (query.search) {
    where.template_name = { [Op.like]: `%${query.search}%` };
  }
  return db.NotificationTemplate.findAll({
    where,
    order: [['updated_at', 'DESC']],
    limit: 200, // templates are a small admin-managed set; cap to prevent unbounded scan
    include: [{ model: db.User, as: 'creator', attributes: ['id', 'name'] }],
  });
}

async function createTemplate(adminId, body, ip) {
  const tpl = await db.NotificationTemplate.create({
    template_name: body.template_name,
    template_type: body.template_type,
    title_template: body.title_template,
    body_template: body.body_template,
    variables: body.variables || [],
    is_active: body.is_active !== false,
    created_by: adminId,
  });
  await writeAudit(adminId, 'template_create', 'notification_template', tpl.id, {}, ip);
  return tpl;
}

async function updateTemplate(adminId, id, body, ip) {
  const tpl = await db.NotificationTemplate.findByPk(id);
  if (!tpl) throw new HttpError(404, 'Template not found');
  await tpl.update(body);
  await writeAudit(adminId, 'template_update', 'notification_template', tpl.id, body, ip);
  return tpl;
}

async function deleteTemplate(adminId, id, ip) {
  const tpl = await db.NotificationTemplate.findByPk(id);
  if (!tpl) throw new HttpError(404, 'Template not found');
  await tpl.destroy();
  await writeAudit(adminId, 'template_delete', 'notification_template', id, {}, ip);
}

async function getAnalytics(query) {
  const days = Math.min(90, Math.max(7, parseInt(query.days) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const totalSent = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: since } },
  });
  const delivered = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: since }, delivery_status: { [Op.in]: ['delivered', 'opened', 'clicked'] } },
  });
  const opened = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: since }, delivery_status: { [Op.in]: ['opened', 'clicked'] } },
  });
  const clicked = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: since }, delivery_status: 'clicked' },
  });
  const failed = await db.NotificationDeliveryLog.count({
    where: { created_at: { [Op.gte]: since }, delivery_status: 'failed' },
  });

  const dailySends = await db.NotificationDeliveryLog.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: { created_at: { [Op.gte]: since } },
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  const byChannel = await db.NotificationDeliveryLog.findAll({
    attributes: ['channel', [fn('COUNT', col('id')), 'count']],
    where: { created_at: { [Op.gte]: since } },
    group: ['channel'],
    raw: true,
  });

  const byStatus = await db.NotificationDeliveryLog.findAll({
    attributes: ['delivery_status', [fn('COUNT', col('id')), 'count']],
    where: { created_at: { [Op.gte]: since } },
    group: ['delivery_status'],
    raw: true,
  });

  const deviceBreakdown = await db.sequelize.query(
    `SELECT ud.platform AS platform, COUNT(DISTINCT ndl.recipient_id) AS count
     FROM notification_delivery_logs ndl
     INNER JOIN user_devices ud ON ud.user_id = ndl.recipient_id AND ud.is_active = 1
     WHERE ndl.created_at >= :since AND ndl.channel = 'push'
     GROUP BY ud.platform`,
    { replacements: { since }, type: db.sequelize.QueryTypes.SELECT }
  );

  // Top campaigns by engagement
  const topCampaigns = await db.sequelize.query(
    `SELECT
       nc.id, nc.campaign_name, nc.sent_at,
       COUNT(CASE WHEN ndl.delivery_status IN ('delivered','opened','clicked') THEN 1 END) AS sent,
       COUNT(CASE WHEN ndl.delivery_status IN ('opened','clicked') THEN 1 END) AS opened,
       COUNT(CASE WHEN ndl.delivery_status = 'clicked' THEN 1 END) AS clicked,
       COUNT(CASE WHEN ndl.delivery_status = 'failed' THEN 1 END) AS failed
     FROM notification_campaigns nc
     INNER JOIN notification_delivery_logs ndl ON ndl.campaign_id = nc.id
     WHERE nc.created_at >= :since
     GROUP BY nc.id, nc.campaign_name, nc.sent_at
     ORDER BY sent DESC
     LIMIT 10`,
    { replacements: { since }, type: db.sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  // By segment
  const bySegment = await db.sequelize.query(
    `SELECT
       CASE
         WHEN u.role = 'customer' THEN 'Customers'
         WHEN u.role = 'driver' THEN 'Providers'
         ELSE u.role
       END AS segment,
       COUNT(ndl.id) AS count
     FROM notification_delivery_logs ndl
     INNER JOIN users u ON u.id = ndl.recipient_id
     WHERE ndl.created_at >= :since
     GROUP BY u.role`,
    { replacements: { since }, type: db.sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  return {
    summary: {
      totalSent,
      deliveryRate: totalSent ? Math.round((delivered / totalSent) * 100) : 0,
      openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
      clickRate: delivered ? Math.round((clicked / delivered) * 100) : 0,
      failed,
    },
    dailySends,
    byChannel,
    byStatus,
    deviceBreakdown,
    topCampaigns: topCampaigns.map((c) => ({
      id: Number(c.id),
      campaign_name: c.campaign_name,
      sent: Number(c.sent || 0),
      opened: Number(c.opened || 0),
      clicked: Number(c.clicked || 0),
      failed: Number(c.failed || 0),
      open_rate: c.sent ? Math.round((Number(c.opened) / Number(c.sent)) * 100) : 0,
      click_rate: c.sent ? Math.round((Number(c.clicked) / Number(c.sent)) * 100) : 0,
      sent_at: c.sent_at || null,
    })),
    bySegment: bySegment.map((s) => ({ segment: s.segment, count: Number(s.count) })),
  };
}

async function listLogs(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const offset = (page - 1) * limit;
  const where = {};

  if (query.channel) where.channel = query.channel;
  if (query.delivery_status) where.delivery_status = query.delivery_status;
  if (query.campaign_id) where.campaign_id = query.campaign_id;
  if (query.from_date) where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(query.from_date) };
  if (query.to_date) where.created_at = { ...(where.created_at || {}), [Op.lte]: new Date(query.to_date) };

  const include = [
    { model: db.User, as: 'recipient', attributes: ['id', 'name', 'email', 'role'] },
    { model: db.NotificationCampaign, as: 'campaign', attributes: ['id', 'campaign_name'] },
  ];

  if (query.search) {
    include[0].where = {
      [Op.or]: [
        { name: { [Op.like]: `%${query.search}%` } },
        { email: { [Op.like]: `%${query.search}%` } },
      ],
    };
  }
  if (query.user_type) {
    include[0].where = { ...(include[0].where || {}), role: query.user_type === 'provider' ? 'driver' : query.user_type };
  }

  const { count, rows } = await db.NotificationDeliveryLog.findAndCountAll({
    where,
    include,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count, totalPages: Math.ceil(count / limit), currentPage: page };
}

async function exportAnalyticsReport(query, format = 'csv') {
  const analytics = await getAnalytics(query);
  const lines = [
    'metric,value',
    `total_sent,${analytics.summary.totalSent}`,
    `delivery_rate,${analytics.summary.deliveryRate}`,
    `open_rate,${analytics.summary.openRate}`,
    `click_rate,${analytics.summary.clickRate}`,
    `failed,${analytics.summary.failed}`,
    '',
    'date,sends',
    ...analytics.dailySends.map((r) => `${r.date},${r.count}`),
  ];
  return { content: lines.join('\n'), mime: format === 'csv' ? 'text/csv' : 'text/csv' };
}

module.exports = {
  getDashboard,
  sendNotification,
  processCampaignBatch,
  processScheduledCampaign,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  retryCampaign,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getAnalytics,
  listLogs,
  exportAnalyticsReport,
  resolveAudienceUserIds,
};
