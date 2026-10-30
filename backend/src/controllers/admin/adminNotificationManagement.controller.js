const adminNotificationManagement = require('../../services/admin/adminNotificationManagement.service');

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

async function getDashboard(req, res, next) {
  try {
    const data = await adminNotificationManagement.getDashboard();
    return res.success('Notification dashboard fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function sendNotification(req, res, next) {
  try {
    const data = await adminNotificationManagement.sendNotification(
      req.auth.userId,
      req.body,
      clientIp(req)
    );
    return res.success('Notification queued', data);
  } catch (err) {
    return next(err);
  }
}

async function getNotificationDetail(req, res, next) {
  try {
    const data = await adminNotificationManagement.getCampaign(req.params.id);
    return res.success('Notification fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function listCampaigns(req, res, next) {
  try {
    const data = await adminNotificationManagement.listCampaigns(req.query);
    return res.success('Campaigns fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function createCampaign(req, res, next) {
  try {
    const data = await adminNotificationManagement.createCampaign(
      req.auth.userId,
      req.body,
      clientIp(req)
    );
    return res.success('Campaign created', data);
  } catch (err) {
    return next(err);
  }
}

async function updateCampaign(req, res, next) {
  try {
    const data = await adminNotificationManagement.updateCampaign(
      req.auth.userId,
      req.params.id,
      req.body,
      clientIp(req)
    );
    return res.success('Campaign updated', data);
  } catch (err) {
    return next(err);
  }
}

async function deleteCampaign(req, res, next) {
  try {
    const data = await adminNotificationManagement.deleteCampaign(
      req.auth.userId,
      req.params.id,
      clientIp(req)
    );
    return res.success('Campaign cancelled', data);
  } catch (err) {
    return next(err);
  }
}

async function duplicateCampaign(req, res, next) {
  try {
    const data = await adminNotificationManagement.duplicateCampaign(
      req.auth.userId,
      req.params.id,
      clientIp(req)
    );
    return res.success('Campaign duplicated', data);
  } catch (err) {
    return next(err);
  }
}

async function retryCampaign(req, res, next) {
  try {
    const data = await adminNotificationManagement.retryCampaign(
      req.auth.userId,
      req.params.id,
      clientIp(req)
    );
    return res.success('Campaign retry queued', data);
  } catch (err) {
    return next(err);
  }
}

async function listTemplates(req, res, next) {
  try {
    const data = await adminNotificationManagement.listTemplates(req.query);
    return res.success('Templates fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function createTemplate(req, res, next) {
  try {
    const data = await adminNotificationManagement.createTemplate(
      req.auth.userId,
      req.body,
      clientIp(req)
    );
    return res.success('Template created', data);
  } catch (err) {
    return next(err);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const data = await adminNotificationManagement.updateTemplate(
      req.auth.userId,
      req.params.id,
      req.body,
      clientIp(req)
    );
    return res.success('Template updated', data);
  } catch (err) {
    return next(err);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    await adminNotificationManagement.deleteTemplate(
      req.auth.userId,
      req.params.id,
      clientIp(req)
    );
    return res.success('Template deleted');
  } catch (err) {
    return next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const data = await adminNotificationManagement.getAnalytics(req.query);
    return res.success('Analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function exportAnalytics(req, res, next) {
  try {
    const format = req.query.format || 'csv';
    const { content, mime } = await adminNotificationManagement.exportAnalyticsReport(
      req.query,
      format
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="notification-analytics.${format}"`);
    return res.send(content);
  } catch (err) {
    return next(err);
  }
}

async function listLogs(req, res, next) {
  try {
    const data = await adminNotificationManagement.listLogs(req.query);
    return res.success('Notification logs fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function estimateAudience(req, res, next) {
  try {
    const filters = req.body.audience_filters || { segment: req.body.segment || 'all_customers' };
    const userIds = await adminNotificationManagement.resolveAudienceUserIds(filters);
    return res.success('Audience estimated', { count: userIds.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDashboard,
  sendNotification,
  getNotificationDetail,
  listCampaigns,
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
  exportAnalytics,
  listLogs,
  estimateAudience,
};
