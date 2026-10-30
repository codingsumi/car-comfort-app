const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');
const auditLogService = require('./auditLog.service');
const { logger } = require('../config/logger');

const OPEN_ALERT_STATUSES = ['open', 'investigating'];
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function dateRangeWhere(dateFrom, dateTo, field = 'created_at') {
  if (!dateFrom && !dateTo) return undefined;
  return {
    [field]: {
      ...(dateFrom ? { [Op.gte]: new Date(dateFrom) } : {}),
      ...(dateTo ? { [Op.lte]: new Date(dateTo) } : {}),
    },
  };
}

async function recordAuthEvent({ userId, emailAttempt, eventType, actorType = 'admin', ipAddress, deviceInfo, metadata }) {
  try {
    await db.AuthEvent.create({
      user_id: userId || null,
      email_attempt: emailAttempt || null,
      event_type: eventType,
      actor_type: actorType,
      ip_address: ipAddress,
      device_info: deviceInfo,
      metadata: metadata || null,
    });
  } catch (err) {
    logger.warn('Auth event write failed', { eventType, message: err?.message });
  }
}

async function createSecurityAlert({ alertType, severity, entityType, entityId, recommendedAction, metadata }) {
  const existing = await db.SecurityAlert.findOne({
    where: {
      alert_type: alertType,
      entity_type: entityType || null,
      entity_id: entityId || null,
      status: { [Op.in]: OPEN_ALERT_STATUSES },
    },
  });
  if (existing) return existing;

  return db.SecurityAlert.create({
    alert_type: alertType,
    severity,
    entity_type: entityType,
    entity_id: entityId,
    status: 'open',
    recommended_action: recommendedAction,
    metadata,
  });
}

async function checkFailedLoginAlerts(ipAddress, emailAttempt) {
  const since = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
  const where = {
    event_type: 'login_failed',
    actor_type: 'admin',
    created_at: { [Op.gte]: since },
  };
  if (ipAddress) where.ip_address = ipAddress;

  const count = await db.AuthEvent.count({ where });
  if (count >= FAILED_LOGIN_THRESHOLD) {
    await createSecurityAlert({
      alertType: 'multiple_failed_logins',
      severity: count >= 10 ? 'critical' : 'high',
      entityType: 'ip_address',
      entityId: null,
      recommendedAction: 'Review IP and consider blocking or forcing password resets',
      metadata: { ip_address: ipAddress, email_attempt: emailAttempt, failure_count: count },
    });
  }
}

async function checkExportVolumeAlert(adminId) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const exportCount = await db.AdminAuditLog.count({
    where: {
      admin_id: adminId,
      action_type: { [Op.like]: '%export%' },
      created_at: { [Op.gte]: hourAgo },
    },
  });
  if (exportCount >= 5) {
    await createSecurityAlert({
      alertType: 'excessive_exports',
      severity: 'high',
      entityType: 'admin',
      entityId: adminId,
      recommendedAction: 'Verify admin activity and review export logs',
      metadata: { export_count: exportCount },
    });
  }
}

async function createAdminSession(adminId, ipAddress, deviceInfo) {
  const tokenId = crypto.randomUUID();
  const now = new Date();
  const session = await db.AdminSession.create({
    admin_id: adminId,
    token_id: tokenId,
    ip_address: ipAddress,
    device_info: deviceInfo,
    login_at: now,
    last_activity_at: now,
    is_revoked: false,
  });
  return { session, sessionId: session.id, tokenId };
}

async function touchAdminSession(sessionId) {
  if (!sessionId) return;
  await db.AdminSession.update(
    { last_activity_at: new Date() },
    { where: { id: sessionId, is_revoked: false } }
  );
}

async function getSecurityDashboard({ dateFrom, dateTo } = {}) {
  runPeriodicDetection().catch(() => {});
  const range = dateRangeWhere(dateFrom, dateTo);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalAdmins,
    activeSessions,
    failedLogins24h,
    openAlerts,
    pendingCompliance,
    deletionRequests,
    passwordResets24h,
    recentCritical,
    recentLogins,
    recentFailed,
    recentSensitive,
    openAlertRows,
  ] = await Promise.all([
    db.User.count({ where: { role: 'admin', is_verified: true } }),
    db.AdminSession.count({ where: { is_revoked: false, last_activity_at: { [Op.gte]: dayAgo } } }),
    db.AuthEvent.count({
      where: { event_type: 'login_failed', actor_type: 'admin', created_at: { [Op.gte]: dayAgo } },
    }),
    db.SecurityAlert.count({ where: { status: { [Op.in]: OPEN_ALERT_STATUSES } } }),
    db.ComplianceRequest.count({ where: { request_status: { [Op.in]: ['pending', 'verified', 'processing'] } } }),
    db.ComplianceRequest.count({
      where: { request_type: 'account_deletion', request_status: { [Op.ne]: 'completed' } },
    }),
    db.AuthEvent.count({
      where: { event_type: 'password_reset', actor_type: 'admin', created_at: { [Op.gte]: dayAgo } },
    }),
    db.AdminAuditLog.findAll({
      where: { ...(range || {}), severity: { [Op.in]: ['high', 'critical'] } },
      include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    db.AuthEvent.findAll({
      where: { event_type: 'login_success', actor_type: 'admin', created_at: { [Op.gte]: dayAgo } },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 8,
    }),
    db.AuthEvent.findAll({
      where: { event_type: 'login_failed', actor_type: 'admin', created_at: { [Op.gte]: dayAgo } },
      order: [['created_at', 'DESC']],
      limit: 8,
    }),
    db.AdminAuditLog.findAll({
      where: {
        ...(range || {}),
        severity: { [Op.in]: ['medium', 'high', 'critical'] },
        action_type: {
          [Op.notLike]: 'admin_login%',
        },
      },
      include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 8,
    }),
    db.SecurityAlert.findAll({
      where: { status: { [Op.in]: OPEN_ALERT_STATUSES } },
      order: [
        [literal(`FIELD(severity, 'critical', 'high', 'medium', 'low')`), 'ASC'],
        ['created_at', 'DESC'],
      ],
      limit: 6,
    }),
  ]);

  const activeAdmins = await db.AdminSession.findAll({
    where: { is_revoked: false, last_activity_at: { [Op.gte]: dayAgo } },
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
    order: [['last_activity_at', 'DESC']],
    limit: 10,
  });

  return {
    summary: {
      total_admin_users: totalAdmins,
      active_admin_sessions: activeSessions,
      failed_login_attempts_24h: failedLogins24h,
      suspicious_activities: openAlerts,
      pending_compliance_requests: pendingCompliance,
      account_deletion_requests: deletionRequests,
      recent_password_resets_24h: passwordResets24h,
    },
    live: {
      active_admins: activeAdmins.map((s) => {
        const p = s.get({ plain: true });
        return {
          session_id: p.id,
          admin: p.admin,
          ip_address: p.ip_address,
          device_info: p.device_info,
          login_at: p.login_at,
          last_activity_at: p.last_activity_at,
        };
      }),
      recent_logins: recentLogins.map((r) => r.get({ plain: true })),
      failed_auth_attempts: recentFailed.map((r) => r.get({ plain: true })),
      recent_sensitive_actions: recentSensitive.map((r) => r.get({ plain: true })),
      security_alerts: openAlertRows.map((r) => r.get({ plain: true })),
    },
    recent_critical_actions: recentCritical.map((r) => r.get({ plain: true })),
  };
}

async function getLiveSecurityWidgets() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activeSessions, failedLogins, openAlerts, criticalAlerts, pendingCompliance] = await Promise.all([
    db.AdminSession.count({ where: { is_revoked: false, last_activity_at: { [Op.gte]: dayAgo } } }),
    db.AuthEvent.count({
      where: { event_type: 'login_failed', actor_type: 'admin', created_at: { [Op.gte]: dayAgo } },
    }),
    db.SecurityAlert.count({ where: { status: { [Op.in]: OPEN_ALERT_STATUSES } } }),
    db.SecurityAlert.count({
      where: { status: { [Op.in]: OPEN_ALERT_STATUSES }, severity: { [Op.in]: ['critical', 'high'] } },
    }),
    db.ComplianceRequest.count({ where: { request_status: 'pending' } }),
  ]);

  return {
    active_admin_sessions: activeSessions,
    failed_login_attempts_24h: failedLogins,
    open_security_alerts: openAlerts,
    critical_alerts: criticalAlerts,
    pending_compliance_requests: pendingCompliance,
  };
}

async function listAdminSessions(params = {}) {
  const { page = 1, limit = 30, admin_id, active_only = 'true' } = params;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  if (admin_id) where.admin_id = admin_id;
  if (active_only === 'true' || active_only === true) {
    where.is_revoked = false;
    where.last_activity_at = { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  }

  const { count, rows } = await db.AdminSession.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
    order: [['last_activity_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  const sessions = rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      id: p.id,
      admin: p.admin,
      ip_address: p.ip_address,
      device_info: p.device_info,
      login_at: p.login_at,
      last_activity_at: p.last_activity_at,
      is_revoked: p.is_revoked,
      status: p.is_revoked ? 'revoked' : 'active',
    };
  });

  return {
    sessions,
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function revokeSession(sessionId, adminId, ipAddress) {
  const session = await db.AdminSession.findByPk(sessionId, {
    include: [{ model: db.User, as: 'admin' }],
  });
  if (!session) return null;
  if (session.is_revoked) return session;

  await session.update({ is_revoked: true, revoked_at: new Date() });

  await auditLogService.logAdminAction({
    adminId,
    actionType: 'session_revoked',
    entityType: 'admin_session',
    entityId: session.id,
    details: { target_admin_id: session.admin_id },
    ipAddress,
  });

  return session;
}

async function forceLogoutSession(sessionId, adminId, ipAddress) {
  const session = await revokeSession(sessionId, adminId, ipAddress);
  if (!session) return null;

  const targetAdmin = await db.User.findByPk(session.admin_id);
  if (targetAdmin) {
    await targetAdmin.update({ token_version: Number(targetAdmin.token_version || 0) + 1 });
    await db.AdminSession.update(
      { is_revoked: true, revoked_at: new Date() },
      { where: { admin_id: session.admin_id, is_revoked: false } }
    );
  }

  await auditLogService.logAdminAction({
    adminId,
    actionType: 'session_force_logout',
    entityType: 'admin',
    entityId: session.admin_id,
    details: { session_id: session.id },
    ipAddress,
    severity: 'high',
  });

  return session;
}

async function listComplianceRequests(params = {}) {
  const { page = 1, limit = 30, request_type, request_status, search } = params;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;
  const where = {};

  if (request_type) where.request_type = request_type;
  if (request_status) where.request_status = request_status;

  const userInclude = {
    model: db.User,
    as: 'user',
    attributes: ['id', 'name', 'email', 'phone', 'role', 'status'],
    ...(search
      ? {
          where: {
            [Op.or]: [
              { name: { [Op.like]: `%${search}%` } },
              { email: { [Op.like]: `%${search}%` } },
            ],
          },
        }
      : {}),
  };

  const { count, rows } = await db.ComplianceRequest.findAndCountAll({
    where,
    include: [userInclude, { model: db.User, as: 'processor', attributes: ['id', 'name'] }],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  return {
    requests: rows.map((r) => r.get({ plain: true })),
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function createComplianceRequest({ userId, requestType, deletionType, notes, adminId, ipAddress }) {
  const user = await db.User.findByPk(userId);
  if (!user || user.role === 'admin') {
    const err = new Error(user ? 'Cannot create compliance request for admin users' : 'User not found');
    err.statusCode = user ? 403 : 404;
    throw err;
  }

  const request = await db.ComplianceRequest.create({
    user_id: userId,
    request_type: requestType,
    request_status: 'pending',
    deletion_type: deletionType || null,
    notes: notes || null,
  });

  await auditLogService.logAdminAction({
    adminId,
    actionType: 'compliance_request_created',
    entityType: 'compliance_request',
    entityId: request.id,
    details: { request_type: requestType, user_id: userId },
    ipAddress,
    module: 'compliance',
  });

  return request;
}

async function buildUserDataExport(userId) {
  const user = await db.User.findByPk(userId, {
    attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry', 'social_token'] },
  });
  if (!user) return null;

  const [bookings, vehicles, reviews, supportTickets] = await Promise.all([
    db.Booking.findAll({
      where: { user_id: userId },
      attributes: ['id', 'status', 'created_at', 'total_price'],
      limit: 500,
    }),
    db.Vehicle.findAll({
      where: { user_id: userId },
      attributes: ['id', 'make', 'model', 'year', 'license_plate'],
      limit: 100,
    }),
    db.Review.findAll({
      where: { reviewer_user_id: userId },
      attributes: ['id', 'rating', 'message', 'created_at'],
      limit: 200,
    }),
    db.SupportTicket.findAll({
      where: { user_id: userId },
      attributes: ['id', 'ticket_number', 'subject', 'status', 'created_at'],
      limit: 100,
    }),
  ]);

  return {
    exported_at: new Date().toISOString(),
    user: user.get({ plain: true }),
    bookings: bookings.map((b) => b.get({ plain: true })),
    vehicles: vehicles.map((v) => v.get({ plain: true })),
    reviews: reviews.map((r) => r.get({ plain: true })),
    support_tickets: supportTickets.map((t) => t.get({ plain: true })),
  };
}

async function saveExportFile(userId, data) {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const complianceDir = path.join(uploadDir, 'compliance');
  await fs.mkdir(complianceDir, { recursive: true });
  const filename = `user-${userId}-${Date.now()}.json`;
  const filePath = path.join(complianceDir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  const publicBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
  return `${publicBase}/compliance/${filename}`;
}

async function anonymizeUser(user) {
  const anonId = `deleted_${user.id}_${Date.now()}`;
  await user.update({
    name: 'Deleted User',
    first_name: null,
    last_name: null,
    email: `${anonId}@anonymized.local`,
    phone: null,
    profile: null,
    social_id: null,
    social_token: null,
    password: null,
    status: 'deactivated',
    deactivated_at: new Date(),
    token_version: Number(user.token_version || 0) + 1,
  });
}

async function processComplianceRequest(requestId, { adminId, ipAddress, action, deletionType, notes }) {
  const request = await db.ComplianceRequest.findByPk(requestId, {
    include: [{ model: db.User, as: 'user' }],
  });
  if (!request) {
    const err = new Error('Compliance request not found');
    err.statusCode = 404;
    throw err;
  }

  const user = request.user;
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const effectiveDeletionType = deletionType || request.deletion_type;

  if (action === 'verify') {
    await request.update({ request_status: 'verified', notes: notes || request.notes });
    return request.reload({ include: [{ model: db.User, as: 'user' }] });
  }

  if (action === 'reject') {
    await request.update({
      request_status: 'rejected',
      processed_by: adminId,
      processed_at: new Date(),
      notes: notes || request.notes,
    });
    await auditLogService.logAdminAction({
      adminId,
      actionType: 'compliance_request_rejected',
      entityType: 'compliance_request',
      entityId: request.id,
      ipAddress,
      module: 'compliance',
    });
    return request.reload({ include: [{ model: db.User, as: 'user' }] });
  }

  if (action === 'export' || action === 'complete') {
    await request.update({ request_status: 'processing' });

    const exportData = await buildUserDataExport(user.id);
    const exportUrl = await saveExportFile(user.id, exportData);
    await request.update({ export_url: exportUrl });

    if (action === 'export') {
      await request.update({
        request_status: 'verified',
        processed_by: adminId,
        processed_at: new Date(),
      });
      await auditLogService.logAdminAction({
        adminId,
        actionType: 'data_export',
        entityType: 'user',
        entityId: user.id,
        details: { export_url: exportUrl, compliance_request_id: request.id },
        ipAddress,
        module: 'compliance',
        severity: 'high',
      });
      await checkExportVolumeAlert(adminId);
      return request.reload({ include: [{ model: db.User, as: 'user' }] });
    }
  }

  if (action === 'complete') {
    const type = effectiveDeletionType || 'soft_delete';

    if (!request.export_url && request.request_type === 'account_deletion') {
      const exportData = await buildUserDataExport(user.id);
      const exportUrl = await saveExportFile(user.id, exportData);
      await request.update({ export_url: exportUrl });
    }

    if (type === 'soft_delete') {
      await user.update({
        status: 'deactivated',
        deactivated_at: new Date(),
        token_version: Number(user.token_version || 0) + 1,
      });
    } else if (type === 'anonymization') {
      await anonymizeUser(user);
    } else if (type === 'permanent_delete') {
      if (user.role === 'admin') {
        const err = new Error('Cannot permanently delete admin users');
        err.statusCode = 403;
        throw err;
      }
      await user.destroy();
    }

    await request.update({
      request_status: 'completed',
      deletion_type: type,
      processed_by: adminId,
      processed_at: new Date(),
      notes: notes || request.notes,
    });

    await auditLogService.logAdminAction({
      adminId,
      actionType: `account_deletion_${type}`,
      entityType: 'user',
      entityId: user.id,
      oldValues: { status: user.status },
      newValues: { deletion_type: type, request_status: 'completed' },
      ipAddress,
      module: 'compliance',
      severity: 'critical',
    });

    return request.reload({ include: [{ model: db.User, as: 'user' }] });
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}

async function exportUserData({ userId, adminId, ipAddress }) {
  const user = await db.User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const exportData = await buildUserDataExport(userId);
  const exportUrl = await saveExportFile(userId, exportData);

  const request = await db.ComplianceRequest.create({
    user_id: userId,
    request_type: 'data_export',
    request_status: 'completed',
    export_url: exportUrl,
    processed_by: adminId,
    processed_at: new Date(),
  });

  await auditLogService.logAdminAction({
    adminId,
    actionType: 'data_export',
    entityType: 'user',
    entityId: userId,
    details: { export_url: exportUrl, compliance_request_id: request.id },
    ipAddress,
    module: 'compliance',
    severity: 'high',
  });

  await checkExportVolumeAlert(adminId);

  return { export_url: exportUrl, request: request.get({ plain: true }) };
}

async function listSecurityAlerts(params = {}) {
  const { page = 1, limit = 30, status, severity, alert_type, search } = params;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;
  const where = {};

  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (alert_type) where.alert_type = { [Op.like]: `%${alert_type}%` };
  if (search) {
    const q = String(search).trim();
    if (q) where.alert_type = { [Op.like]: `%${q}%` };
  }

  const { count, rows } = await db.SecurityAlert.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'resolver', attributes: ['id', 'name'] }],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  return {
    alerts: rows.map((r) => r.get({ plain: true })),
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function updateAlertStatus(alertId, { status, adminId, ipAddress }) {
  const alert = await db.SecurityAlert.findByPk(alertId);
  if (!alert) return null;

  const updates = { status };
  if (status === 'resolved') {
    updates.resolved_by = adminId;
    updates.resolved_at = new Date();
  }

  await alert.update(updates);

  await auditLogService.logAdminAction({
    adminId,
    actionType: 'security_alert_status_updated',
    entityType: 'security_alert',
    entityId: alert.id,
    newValues: { status },
    ipAddress,
    module: 'security',
  });

  return alert.reload({ include: [{ model: db.User, as: 'resolver', attributes: ['id', 'name'] }] });
}

async function runPeriodicDetection() {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const rapidRefunds = await db.AdminAuditLog.findAll({
    attributes: ['admin_id', [fn('COUNT', col('id')), 'cnt']],
    where: {
      action_type: { [Op.like]: '%refund%' },
      created_at: { [Op.gte]: hourAgo },
    },
    group: ['admin_id'],
    having: literal('cnt >= 5'),
    raw: true,
  });

  for (const row of rapidRefunds) {
    await createSecurityAlert({
      alertType: 'rapid_refund_actions',
      severity: 'high',
      entityType: 'admin',
      entityId: row.admin_id,
      recommendedAction: 'Review refund activity for potential abuse',
      metadata: { refund_count: Number(row.cnt) },
    });
  }
}

module.exports = {
  recordAuthEvent,
  checkFailedLoginAlerts,
  checkExportVolumeAlert,
  createAdminSession,
  touchAdminSession,
  getSecurityDashboard,
  getLiveSecurityWidgets,
  listAdminSessions,
  revokeSession,
  forceLogoutSession,
  listComplianceRequests,
  createComplianceRequest,
  processComplianceRequest,
  exportUserData,
  listSecurityAlerts,
  updateAlertStatus,
  runPeriodicDetection,
  createSecurityAlert,
};
