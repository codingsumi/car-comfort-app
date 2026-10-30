const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sendEmail } = require('./email.service');
const { logger } = require('../config/logger');
const { bufferToWebp, saveWebpFile, saveBinaryFile } = require('../utils/fileUpload');

const REPORT_ATTACHMENT_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
]);

function videoExtensionForMime(mimetype) {
  const map = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'video/mpeg': 'mpeg',
  };
  return map[String(mimetype || '').toLowerCase()] || 'mp4';
}

async function saveReportAttachment(file, reportId, req) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const isImage = mimetype.startsWith('image/');
  const isVideo = REPORT_ATTACHMENT_VIDEO_MIMES.has(mimetype);
  if (!isImage && !isVideo) return null;

  const uploadDir = `reports/${reportId}`;

  if (isImage) {
    const webp = await bufferToWebp(file.buffer, { maxWidth: 2400, quality: 85 });
    const saved = await saveWebpFile({
      buffer: webp,
      uploadDir,
      req,
      fileBaseName: file.originalname || 'attachment',
    });
    return saved.absoluteUrl;
  }

  const saved = await saveBinaryFile({
    buffer: file.buffer,
    uploadDir,
    req,
    fileBaseName: file.originalname || 'video',
    extension: videoExtensionForMime(mimetype),
  });
  return saved.absoluteUrl;
}

const ATTACHMENT_REQUIRED_REPORT_TYPES = new Set(['vehicle_damage', 'missing_item']);
const ADMIN_NOTIFY_REPORT_TYPES = new Set(['vehicle_damage', 'missing_item']);

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function listReports(params = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    report_type,
    date_from,
    date_to,
    user_type,
    search,
    sort = 'created_at',
    order = 'desc',
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (report_type) where.report_type = report_type;
  if (date_from || date_to) {
    where.created_at = {
      ...(date_from ? { [Op.gte]: new Date(date_from) } : {}),
      ...(date_to ? { [Op.lte]: new Date(date_to) } : {}),
    };
  }
  if (search) {
    where[Op.or] = [
      { description: { [Op.like]: `%${search}%` } },
      { '$reporter.name$': { [Op.like]: `%${search}%` } },
      { '$target.name$': { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    { model: db.User, as: 'reporter', attributes: ['id', 'name', 'email', 'role'], required: !!user_type },
    { model: db.User, as: 'target', attributes: ['id', 'name', 'email', 'role'], required: false },
    { model: db.User, as: 'assignee', attributes: ['id', 'name'], required: false },
    { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'], required: false },
  ];

  if (user_type) {
    include[0].where = { role: user_type };
  }

  const validSorts = ['created_at', 'priority', 'status', 'updated_at'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';

  const { count, rows } = await db.PlatformReport.findAndCountAll({
    where,
    include,
    order: [[sortField, order === 'asc' ? 'ASC' : 'DESC']],
    limit: limitNum,
    offset,
    distinct: true,
    subQuery: false,
  });

  return {
    reports: rows.map((r) => r.get({ plain: true })),
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function getReportById(id) {
  const report = await db.PlatformReport.findByPk(id, {
    include: [
      { model: db.User, as: 'reporter', attributes: { exclude: ['password', 'otp_code'] } },
      { model: db.User, as: 'target', attributes: { exclude: ['password', 'otp_code'] }, required: false },
      { model: db.User, as: 'assignee', attributes: ['id', 'name', 'email'], required: false },
      {
        model: db.Booking,
        as: 'booking',
        required: false,
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name'] },
          { model: db.User, as: 'assigned_driver', attributes: ['id', 'name'], required: false },
        ],
      },
      {
        model: db.PlatformReportNote,
        as: 'notes',
        separate: true,
        include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
        order: [['created_at', 'ASC']],
      },
    ],
  });
  if (!report) throw new HttpError(404, 'Report not found');

  const timeline = await db.AdminAuditLog.findAll({
    where: { entity_type: 'platform_report', entity_id: id },
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
    order: [['created_at', 'ASC']],
  });

  return { report: report.get({ plain: true }), audit_timeline: timeline.map((t) => t.get({ plain: true })) };
}

async function updateReportStatus(id, payload, adminCtx) {
  const report = await db.PlatformReport.findByPk(id);
  if (!report) throw new HttpError(404, 'Report not found');

  const prev = report.get({ plain: true });
  const {
    status,
    priority,
    assigned_to,
    resolution_notes,
    escalate,
    suspend_target_user,
    suspend_reason,
  } = payload;

  const updates = {};
  if (priority) updates.priority = priority;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
  if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
  if (escalate) {
    updates.status = 'escalated';
    updates.escalated_at = new Date();
  } else if (status) {
    updates.status = status;
    if (status === 'escalated') updates.escalated_at = new Date();
  }

  await report.update(updates);

  if (suspend_target_user && report.target_user_id) {
    const target = await db.User.findByPk(report.target_user_id);
    if (target && target.role !== 'admin') {
      await target.update({
        status: 'suspended',
        suspended_reason: suspend_reason || `Suspended from report #${report.id}`,
        suspended_at: new Date(),
      });
      await db.AdminAuditLog.create({
        admin_id: adminCtx.adminId,
        action_type: 'user_suspended_from_report',
        entity_type: 'user',
        entity_id: target.id,
        details: { report_id: report.id, reason: suspend_reason },
        ip_address: adminCtx.ipAddress,
      });
    }
  }

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'report_status_updated',
    entity_type: 'platform_report',
    entity_id: report.id,
    details: {
      previous: { status: prev.status, priority: prev.priority },
      next: report.get({ plain: true }),
    },
    ip_address: adminCtx.ipAddress,
  });

  if (report.priority === 'critical' || updates.status === 'escalated') {
    await notifyAdminsCriticalReport(report, adminCtx).catch((e) =>
      logger.warn('critical_report_notify_failed', { message: e?.message })
    );
  }

  return report.reload({
    include: [
      { model: db.User, as: 'reporter', attributes: ['id', 'name', 'email', 'role'] },
      { model: db.User, as: 'target', attributes: ['id', 'name', 'email', 'role'], required: false },
      { model: db.User, as: 'assignee', attributes: ['id', 'name'], required: false },
    ],
  });
}

async function notifyAdminsCriticalReport(report, adminCtx) {
  const admins = await db.User.findAll({
    where: { role: 'admin', status: 'active' },
    attributes: ['id', 'email', 'name'],
  });
  const subject = `[Car Comfort] Critical platform report #${report.id}`;
  const text = `Report #${report.id} requires attention.\nPriority: ${report.priority}\nType: ${report.report_type}\n`;
  for (const a of admins) {
    if (a.email) {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({ to: a.email, subject, text }).catch(() => {});
    }
  }
}

async function addReportNote(id, { note, is_internal }, adminCtx) {
  const report = await db.PlatformReport.findByPk(id);
  if (!report) throw new HttpError(404, 'Report not found');

  const row = await db.PlatformReportNote.create({
    report_id: id,
    admin_id: adminCtx.adminId,
    note,
    is_internal: Boolean(is_internal),
  });

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'report_note_added',
    entity_type: 'platform_report',
    entity_id: id,
    details: { note_preview: String(note).slice(0, 200) },
    ip_address: adminCtx.ipAddress,
  });

  return row.reload({ include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }] });
}

async function createReportFromUser(payload, reporterUserId, { files = [], req } = {}) {
  const {
    target_user_id,
    booking_id,
    report_type,
    description,
    priority = 'medium',
    attachment_urls,
  } = payload;

  const allowed = db.PlatformReport.REPORT_TYPES || [];
  if (!allowed.includes(report_type)) {
    throw new HttpError(400, `Invalid report_type`);
  }

  const desc = String(description || '').trim();
  if (desc.length < 10) throw new HttpError(400, 'Description must be at least 10 characters');

  const initialUrls = Array.isArray(attachment_urls)
    ? attachment_urls.filter((url) => String(url || '').trim())
    : [];
  const fileList = Array.isArray(files) ? files.slice(0, 10) : [];

  if (ATTACHMENT_REQUIRED_REPORT_TYPES.has(report_type) && !initialUrls.length && !fileList.length) {
    throw new HttpError(400, 'Please attach at least one photo or video');
  }

  const row = await db.PlatformReport.create({
    reporter_user_id: reporterUserId,
    target_user_id: target_user_id || null,
    booking_id: booking_id || null,
    report_type,
    description: desc,
    priority,
    attachment_urls: initialUrls.length ? initialUrls : null,
    status: 'open',
  });

  const uploadedUrls = [];
  for (const file of fileList) {
    // eslint-disable-next-line no-await-in-loop
    const url = await saveReportAttachment(file, row.id, req);
    if (url) uploadedUrls.push(url);
  }

  const allUrls = [...initialUrls, ...uploadedUrls];
  if (uploadedUrls.length || (initialUrls.length && !row.attachment_urls)) {
    await row.update({ attachment_urls: allUrls.length ? allUrls : null });
  }

  await row.reload();

  if (priority === 'critical' || ADMIN_NOTIFY_REPORT_TYPES.has(report_type)) {
    await notifyAdminsCriticalReport(row, { adminId: reporterUserId }).catch(() => {});
  }

  return row;
}

module.exports = {
  listReports,
  getReportById,
  updateReportStatus,
  addReportNote,
  createReportFromUser,
  getClientIp,
};
