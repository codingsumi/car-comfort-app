const adminSecurityService = require('../../services/adminSecurity.service');
const auditLogService = require('../../services/auditLog.service');
const platformReportsService = require('../../services/platformReports.service');
const { HttpError } = require('../../utils/httpError');

function getClientIp(req) {
  return platformReportsService.getClientIp(req);
}

function getDeviceInfo(req) {
  return auditLogService.parseDeviceInfo(req.headers['user-agent']);
}

async function getDashboard(req, res, next) {
  try {
    const data = await adminSecurityService.getSecurityDashboard({
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    });
    return res.success('Security dashboard', data);
  } catch (e) {
    return next(e);
  }
}

async function getLiveWidgets(req, res, next) {
  try {
    const data = await adminSecurityService.getLiveSecurityWidgets();
    return res.success('Live security widgets', data);
  } catch (e) {
    return next(e);
  }
}

async function listLogs(req, res, next) {
  try {
    if (req.query.format === 'csv') {
      const result = await auditLogService.listActivityLogs({ ...req.query, limit: 5000, page: 1 });
      const csv = auditLogService.logsToCsv(result.logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activity-logs.csv"');
      return res.send(csv);
    }
    const data = await auditLogService.listActivityLogs(req.query);
    return res.success('Activity logs', data);
  } catch (e) {
    return next(e);
  }
}

async function getLogById(req, res, next) {
  try {
    const log = await auditLogService.getActivityLogById(req.params.id);
    if (!log) throw new HttpError(404, 'Log not found');
    return res.success('Activity log detail', log);
  } catch (e) {
    return next(e);
  }
}

async function listSessions(req, res, next) {
  try {
    const data = await adminSecurityService.listAdminSessions(req.query);
    return res.success('Admin sessions', data);
  } catch (e) {
    return next(e);
  }
}

async function revokeSession(req, res, next) {
  try {
    const session = await adminSecurityService.revokeSession(
      req.params.id,
      req.auth.userId,
      getClientIp(req)
    );
    if (!session) throw new HttpError(404, 'Session not found');
    return res.success('Session revoked');
  } catch (e) {
    return next(e);
  }
}

async function forceLogoutSession(req, res, next) {
  try {
    const session = await adminSecurityService.forceLogoutSession(
      req.params.id,
      req.auth.userId,
      getClientIp(req)
    );
    if (!session) throw new HttpError(404, 'Session not found');
    return res.success('Session force logged out');
  } catch (e) {
    return next(e);
  }
}

async function listCompliance(req, res, next) {
  try {
    const data = await adminSecurityService.listComplianceRequests(req.query);
    return res.success('Compliance requests', data);
  } catch (e) {
    return next(e);
  }
}

async function postComplianceRequest(req, res, next) {
  try {
    const { user_id, request_type, deletion_type, notes } = req.body;
    if (!user_id || !request_type) throw new HttpError(400, 'user_id and request_type are required');
    const request = await adminSecurityService.createComplianceRequest({
      userId: user_id,
      requestType: request_type,
      deletionType: deletion_type,
      notes,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Compliance request created', request, 201);
  } catch (e) {
    return next(e);
  }
}

async function processCompliance(req, res, next) {
  try {
    const { action, deletion_type, notes } = req.body;
    if (!action) throw new HttpError(400, 'action is required');
    const request = await adminSecurityService.processComplianceRequest(req.params.id, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
      action,
      deletionType: deletion_type,
      notes,
    });
    return res.success('Compliance request updated', request);
  } catch (e) {
    if (e.statusCode) return next(new HttpError(e.statusCode, e.message));
    return next(e);
  }
}

async function exportUserData(req, res, next) {
  try {
    const { user_id } = req.body;
    if (!user_id) throw new HttpError(400, 'user_id is required');
    const data = await adminSecurityService.exportUserData({
      userId: user_id,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('User data export generated', data);
  } catch (e) {
    if (e.statusCode) return next(new HttpError(e.statusCode, e.message));
    return next(e);
  }
}

async function listAlerts(req, res, next) {
  try {
    const data = await adminSecurityService.listSecurityAlerts(req.query);
    return res.success('Security alerts', data);
  } catch (e) {
    return next(e);
  }
}

async function patchAlertStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) throw new HttpError(400, 'status is required');
    const alert = await adminSecurityService.updateAlertStatus(req.params.id, {
      status,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    if (!alert) throw new HttpError(404, 'Alert not found');
    return res.success('Alert updated', alert);
  } catch (e) {
    return next(e);
  }
}

// Admin accounts security overview
async function getAdminSecurityOverview(req, res, next) {
  try {
    const db = require('../../models');
    const { Op, fn, col, literal } = require('sequelize');

    // Get all admin users with their last login info from audit logs
    const admins = await db.User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id', 'name', 'email', 'created_at'],
    });

    const adminIds = admins.map((a) => a.id);

    // Last login per admin
    const lastLogins = await db.AdminAuditLog.findAll({
      where: { admin_id: { [Op.in]: adminIds }, action_type: { [Op.in]: ['admin_login', 'login'] } },
      attributes: ['admin_id', [fn('MAX', col('created_at')), 'last_login'], 'ip_address'],
      group: ['admin_id'],
      raw: true,
    });
    const lastLoginMap = {};
    for (const l of lastLogins) lastLoginMap[l.admin_id] = l;

    // Failed login attempts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const failedLogins = await db.AdminAuditLog.count({
      where: {
        action_type: { [Op.in]: ['admin_login_failed', 'login_failed'] },
        created_at: { [Op.gte]: sevenDaysAgo },
      },
    });

    // Top IPs from recent audit logs
    const topIps = await db.AdminAuditLog.findAll({
      where: { created_at: { [Op.gte]: sevenDaysAgo } },
      attributes: ['ip_address', [fn('COUNT', col('id')), 'count']],
      group: ['ip_address'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10,
      raw: true,
    });

    // Recent critical audit events
    const criticalEvents = await db.AdminAuditLog.findAll({
      where: {
        severity: { [Op.in]: ['high', 'critical'] },
        created_at: { [Op.gte]: sevenDaysAgo },
      },
      include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    return res.success('Admin security overview fetched', {
      admins: admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        created_at: a.created_at,
        last_login: lastLoginMap[a.id]?.last_login || null,
        last_ip: lastLoginMap[a.id]?.ip_address || null,
      })),
      failed_logins_7d: failedLogins,
      top_ips: topIps.map((r) => ({ ip: r.ip_address, count: parseInt(r.count) })),
      critical_events: criticalEvents,
      recommendations: [
        ...(!admins.some((a) => lastLoginMap[a.id]) ? [{ type: 'warning', message: 'No admin login activity detected in audit logs' }] : []),
        ...(failedLogins > 5 ? [{ type: 'critical', message: `${failedLogins} failed login attempts in the last 7 days` }] : []),
        { type: 'info', message: 'Consider enabling two-factor authentication (2FA) for all admin accounts' },
        { type: 'info', message: 'Regularly review active sessions and revoke any unrecognized ones' },
      ],
    });
  } catch (err) {
    return next(err);
  }
}

// Data retention settings
async function getDataRetentionSettings(req, res, next) {
  try {
    const db = require('../../models');
    const keys = [
      'data_retention_audit_logs_days',
      'data_retention_support_tickets_days',
      'data_retention_notifications_days',
      'data_retention_user_data_days',
    ];
    const settings = await db.AppSetting.findAll({ where: { key: keys } }).catch(() => []);
    const map = {};
    for (const s of settings) map[s.key] = s.value;
    return res.success('Data retention settings fetched', {
      audit_logs_days: parseInt(map.data_retention_audit_logs_days || '365'),
      support_tickets_days: parseInt(map.data_retention_support_tickets_days || '730'),
      notifications_days: parseInt(map.data_retention_notifications_days || '90'),
      user_data_days: parseInt(map.data_retention_user_data_days || '2555'),
    });
  } catch (err) {
    return next(err);
  }
}

async function updateDataRetentionSettings(req, res, next) {
  try {
    const db = require('../../models');
    const { audit_logs_days, support_tickets_days, notifications_days, user_data_days } = req.body;
    const updates = [
      { key: 'data_retention_audit_logs_days', value: String(audit_logs_days || 365) },
      { key: 'data_retention_support_tickets_days', value: String(support_tickets_days || 730) },
      { key: 'data_retention_notifications_days', value: String(notifications_days || 90) },
      { key: 'data_retention_user_data_days', value: String(user_data_days || 2555) },
    ];
    for (const u of updates) {
      await db.AppSetting.upsert(u).catch(() => {});
    }
    await db.AdminAuditLog.create({
      admin_id: req.auth.userId,
      action_type: 'data_retention_updated',
      entity_type: 'system',
      entity_id: 0,
      severity: 'medium',
      details: req.body,
      ip_address: req.ip,
    }).catch(() => {});
    return res.success('Data retention settings updated', req.body);
  } catch (err) {
    return next(err);
  }
}

// Alert notification settings
async function getAlertNotificationSettings(req, res, next) {
  try {
    const db = require('../../models');
    const keys = ['security_alert_email', 'security_alert_email_enabled', 'security_alert_min_severity'];
    const settings = await db.AppSetting.findAll({ where: { key: keys } }).catch(() => []);
    const map = {};
    for (const s of settings) map[s.key] = s.value;
    return res.success('Alert notification settings fetched', {
      email: map.security_alert_email || '',
      enabled: map.security_alert_email_enabled === 'true',
      min_severity: map.security_alert_min_severity || 'high',
    });
  } catch (err) {
    return next(err);
  }
}

async function updateAlertNotificationSettings(req, res, next) {
  try {
    const db = require('../../models');
    const { email, enabled, min_severity } = req.body;
    const updates = [
      { key: 'security_alert_email', value: email || '' },
      { key: 'security_alert_email_enabled', value: String(!!enabled) },
      { key: 'security_alert_min_severity', value: min_severity || 'high' },
    ];
    for (const u of updates) {
      await db.AppSetting.upsert(u).catch(() => {});
    }
    return res.success('Alert notification settings updated', { email, enabled, min_severity });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDashboard,
  getLiveWidgets,
  listLogs,
  getLogById,
  listSessions,
  revokeSession,
  forceLogoutSession,
  listCompliance,
  postComplianceRequest,
  processCompliance,
  exportUserData,
  listAlerts,
  patchAlertStatus,
  getAdminSecurityOverview,
  getDataRetentionSettings,
  updateDataRetentionSettings,
  getAlertNotificationSettings,
  updateAlertNotificationSettings,
};
