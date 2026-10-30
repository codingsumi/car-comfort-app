const { Op } = require('sequelize');
const db = require('../models');
const { logger } = require('../config/logger');

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'api_key', 'otp', 'social_token', 'card', 'cvv'];

const MODULE_PREFIX_MAP = [
  { prefix: 'admin_login', module: 'auth' },
  { prefix: 'admin_logout', module: 'auth' },
  { prefix: 'customer_password', module: 'auth' },
  { prefix: 'provider_password', module: 'auth' },
  { prefix: 'password_', module: 'auth' },
  { prefix: 'refund_', module: 'finance' },
  { prefix: 'payout_', module: 'finance' },
  { prefix: 'pricing_', module: 'finance' },
  { prefix: 'booking_', module: 'bookings' },
  { prefix: 'provider_status', module: 'users' },
  { prefix: 'customer_status', module: 'users' },
  { prefix: 'user_', module: 'users' },
  { prefix: 'account_deletion', module: 'compliance' },
  { prefix: 'compliance_', module: 'compliance' },
  { prefix: 'export_', module: 'compliance' },
  { prefix: 'data_export', module: 'compliance' },
  { prefix: 'ticket_', module: 'support' },
  { prefix: 'faq_', module: 'support' },
  { prefix: 'review_', module: 'moderation' },
  { prefix: 'report_', module: 'moderation' },
  { prefix: 'vehicle_', module: 'vehicles' },
  { prefix: 'notification_', module: 'notifications' },
  { prefix: 'session_', module: 'security' },
  { prefix: 'security_', module: 'security' },
];

function inferModule(actionType) {
  const action = String(actionType || '').toLowerCase();
  for (const { prefix, module } of MODULE_PREFIX_MAP) {
    if (action.startsWith(prefix) || action.includes(prefix)) return module;
  }
  return 'general';
}

function inferSeverity(actionType) {
  const action = String(actionType || '').toLowerCase();
  if (action.includes('delete') || action.includes('permanent') || action.includes('anonymiz')) return 'critical';
  if (action.includes('refund') || action.includes('export') || action.includes('password')) return 'high';
  if (action.includes('status') || action.includes('suspend') || action.includes('revoke')) return 'medium';
  return 'info';
}

function maskValue(key, value) {
  if (value == null) return value;
  const k = String(key).toLowerCase();
  if (SENSITIVE_KEYS.some((s) => k.includes(s))) return '[REDACTED]';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const [ck, cv] of Object.entries(value)) {
      out[ck] = maskValue(ck, cv);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((v, i) => maskValue(String(i), v));
  return value;
}

function maskObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return maskValue('root', obj);
}

function parseDeviceInfo(userAgent) {
  if (!userAgent) return null;
  const ua = String(userAgent).slice(0, 500);
  return ua;
}

async function logAdminAction({
  adminId,
  actionType,
  entityType,
  entityId = null,
  details = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  deviceInfo = null,
  severity = null,
  module = null,
  actorType = 'admin',
}) {
  try {
    const action = String(actionType);
    await db.AdminAuditLog.create({
      admin_id: adminId,
      actor_type: actorType,
      action_type: action,
      entity_type: entityType,
      entity_id: entityId,
      module: module || inferModule(action),
      severity: severity || inferSeverity(action),
      device_info: deviceInfo,
      old_values: oldValues ? maskObject(oldValues) : null,
      new_values: newValues ? maskObject(newValues) : null,
      details: details ? maskObject(details) : null,
      ip_address: ipAddress,
    });
  } catch (err) {
    logger.warn('Audit log write failed', { actionType, message: err?.message });
  }
}

async function listActivityLogs(params = {}) {
  const {
    page = 1,
    limit = 30,
    action_type,
    admin_id,
    severity,
    module,
    entity_type,
    date_from,
    date_to,
    ip_address,
    search,
    sort = 'created_at',
    order = 'desc',
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;
  const andParts = [];

  if (action_type) andParts.push({ action_type: { [Op.like]: `%${String(action_type).trim()}%` } });
  if (admin_id) andParts.push({ admin_id });
  if (severity) andParts.push({ severity: String(severity).trim() });
  if (module) andParts.push({ module: String(module).trim() });
  if (entity_type) andParts.push({ entity_type: String(entity_type).trim() });
  if (ip_address) andParts.push({ ip_address: { [Op.like]: `%${String(ip_address).trim()}%` } });
  if (date_from || date_to) {
    andParts.push({
      created_at: {
        ...(date_from ? { [Op.gte]: new Date(date_from) } : {}),
        ...(date_to ? { [Op.lte]: new Date(date_to) } : {}),
      },
    });
  }
  if (search) {
    const q = String(search).trim();
    if (q) {
      andParts.push({
        [Op.or]: [
          { action_type: { [Op.like]: `%${q}%` } },
          { entity_type: { [Op.like]: `%${q}%` } },
          { module: { [Op.like]: `%${q}%` } },
          ...(Number.isFinite(Number(q)) ? [{ entity_id: Number(q) }] : []),
        ],
      });
    }
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};
  const sortField = ['created_at', 'action_type', 'severity', 'module'].includes(sort) ? sort : 'created_at';
  const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { count, rows } = await db.AdminAuditLog.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
    order: [[sortField, sortDir]],
    limit: limitNum,
    offset,
  });

  const logs = rows.map((r) => {
    const plain = r.get({ plain: true });
    return {
      id: plain.id,
      admin: plain.admin,
      actor_type: plain.actor_type,
      action_type: plain.action_type,
      entity_type: plain.entity_type,
      entity_id: plain.entity_id,
      module: plain.module,
      severity: plain.severity,
      ip_address: plain.ip_address,
      device_info: plain.device_info,
      created_at: plain.created_at,
    };
  });

  return {
    logs,
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function getActivityLogById(id) {
  const row = await db.AdminAuditLog.findByPk(id, {
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
  });
  if (!row) return null;
  const plain = row.get({ plain: true });
  const details = plain.details || {};
  return {
    id: plain.id,
    admin: plain.admin,
    actor_type: plain.actor_type,
    action_type: plain.action_type,
    entity_type: plain.entity_type,
    entity_id: plain.entity_id,
    module: plain.module,
    severity: plain.severity,
    ip_address: plain.ip_address,
    device_info: plain.device_info,
    old_values: maskObject(plain.old_values),
    new_values: maskObject(plain.new_values),
    details: maskObject(details),
    api_endpoint: details.api_endpoint || details.endpoint || null,
    request_metadata: maskObject(details.request_metadata || details.metadata || null),
    related_entities: details.related_entities || null,
    created_at: plain.created_at,
  };
}

function logsToCsv(logs) {
  const header = ['id', 'admin', 'action_type', 'module', 'entity', 'severity', 'ip', 'created_at'];
  const lines = [header.join(',')];
  for (const log of logs) {
    const entity = `${log.entity_type || ''}:${log.entity_id ?? ''}`;
    lines.push(
      [
        log.id,
        `"${(log.admin?.name || '').replace(/"/g, '""')}"`,
        log.action_type,
        log.module || '',
        `"${entity.replace(/"/g, '""')}"`,
        log.severity,
        log.ip_address || '',
        log.created_at,
      ].join(',')
    );
  }
  return lines.join('\n');
}

module.exports = {
  logAdminAction,
  listActivityLogs,
  getActivityLogById,
  logsToCsv,
  maskObject,
  parseDeviceInfo,
  inferModule,
  inferSeverity,
};
