const adminSupportService = require('../../services/adminSupport.service');
const supportTicketsService = require('../../services/supportTickets.service');
const { sendSupportChatNotification } = require('../../services/supportTicketNotify.service');
const faqAdminService = require('../../services/faqAdmin.service');
const platformReportsService = require('../../services/platformReports.service');
const { bufferToWebp, saveWebpFile } = require('../../utils/fileUpload');
const path = require('path');

function getClientIp(req) {
  return platformReportsService.getClientIp(req);
}

async function getAnalytics(req, res, next) {
  try {
    const data = await adminSupportService.getSupportDashboard({
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    });
    return res.success('Support dashboard', data);
  } catch (e) {
    return next(e);
  }
}

async function getLiveWidgets(req, res, next) {
  try {
    const data = await adminSupportService.getLiveSupportWidgets();
    return res.success('Live support widgets', data);
  } catch (e) {
    return next(e);
  }
}

async function getIssues(req, res, next) {
  try {
    const data = await adminSupportService.getIssueAnalytics({
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
    });
    return res.success('Issue analytics', data);
  } catch (e) {
    return next(e);
  }
}

async function patchAssign(req, res, next) {
  try {
    const { assigned_to, strategy } = req.body;
    const ticket = await supportTicketsService.assignTicket(req.params.id, { assigned_to, strategy }, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Ticket assigned', ticket);
  } catch (e) {
    return next(e);
  }
}

async function postInternalNote(req, res, next) {
  try {
    const msg = await supportTicketsService.addInternalNote(
      req.params.id,
      { note: req.body.note },
      { adminId: req.auth.userId, ipAddress: getClientIp(req) }
    );
    return res.success('Internal note added', msg, 201);
  } catch (e) {
    return next(e);
  }
}

async function postEscalate(req, res, next) {
  try {
    const ticket = await supportTicketsService.escalateTicket(req.params.id, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    await supportTicketsService.notifyAdmins({
      subject: `[Car Comfort] Escalated ticket ${ticket.ticket_number}`,
      text: `Ticket ${ticket.ticket_number} was escalated.\nSubject: ${ticket.subject}\n`,
      excludeAdminId: req.auth.userId,
    });
    return res.success('Ticket escalated', ticket);
  } catch (e) {
    return next(e);
  }
}

async function listFaqs(req, res, next) {
  try {
    const result = await faqAdminService.listFaqs(req.query);
    return res.success('FAQs', result);
  } catch (e) {
    return next(e);
  }
}

async function postFaq(req, res, next) {
  try {
    const row = await faqAdminService.createFaq(req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ created', row, 201);
  } catch (e) {
    return next(e);
  }
}

async function patchFaq(req, res, next) {
  try {
    const row = await faqAdminService.updateFaq(req.params.id, req.body, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ updated', row);
  } catch (e) {
    return next(e);
  }
}

async function deleteFaq(req, res, next) {
  try {
    const result = await faqAdminService.deleteFaq(req.params.id, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQ deleted', result);
  } catch (e) {
    return next(e);
  }
}

async function listFaqCategories(req, res, next) {
  try {
    const rows = await faqAdminService.listCategories();
    return res.success('FAQ categories', rows);
  } catch (e) {
    return next(e);
  }
}

async function postFaqCategory(req, res, next) {
  try {
    const row = await faqAdminService.createCategory(req.body);
    return res.success('Category created', row, 201);
  } catch (e) {
    return next(e);
  }
}

async function patchFaqReorder(req, res, next) {
  try {
    const result = await faqAdminService.reorderFaqs(req.body.ordered_ids, {
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('FAQs reordered', result);
  } catch (e) {
    return next(e);
  }
}

async function saveSupportAttachment(file, ticketId, req) {
  const isPdf = file.mimetype === 'application/pdf';
  const isImage = file.mimetype && file.mimetype.startsWith('image/');
  if (!isPdf && !isImage) return null;

  if (isImage) {
    const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
    const saved = await saveWebpFile({
      buffer: webp,
      uploadDir: `support/${ticketId}`,
      req,
      fileBaseName: file.originalname || 'attachment',
    });
    return saved.absoluteUrl;
  }

  const fs = require('fs');
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const dir = path.join(uploadDir, 'support', String(ticketId));
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(file.originalname || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${Date.now()}-${base}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, file.buffer);
  const publicBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
  return `${publicBase}/support/${ticketId}/${filename}`;
}

async function notifySupportChat(req, res, next) {
  try {
    const data = await sendSupportChatNotification({
      ticketId: req.params.id,
      auth: req.auth,
      messageId: req.body.message_id,
      message: req.body.message,
    });
    return res.success('Notification sent', data);
  } catch (e) {
    return next(e);
  }
}

/**
 * Send a direct support email to a customer from the admin panel.
 * Logs the outgoing email as an internal note on the support ticket (if ticket_id provided).
 */
async function sendEmailToCustomer(req, res, next) {
  try {
    const { to_email, to_name, subject, message, ticket_id } = req.body;

    if (!to_email) throw { status: 400, message: 'Recipient email is required' };
    if (!subject) throw { status: 400, message: 'Subject is required' };
    if (!message) throw { status: 400, message: 'Message body is required' };

    const { sendEmail } = require('../../services/email.service');

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#E4101F;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0">CarComfort Support</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          ${to_name ? `<p style="margin:0 0 16px;color:#555">Hello ${to_name},</p>` : ''}
          <div style="color:#333;line-height:1.6;white-space:pre-wrap">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
          <p style="color:#999;font-size:12px;margin:0">CarComfort Support Team &bull; <a href="mailto:info@carcomfort-llc.com">info@carcomfort-llc.com</a> &bull; 1-800-702-3590</p>
        </div>
      </div>`;

    await sendEmail({
      to: to_email,
      subject,
      text: message,
      html,
    });

    // Log as internal note on the ticket if provided
    if (ticket_id) {
      await supportTicketsService.addInternalNote(
        ticket_id,
        { note: `[Email sent to ${to_email}]\n\nSubject: ${subject}\n\n${message}` },
        { adminId: req.auth.userId, ipAddress: getClientIp(req) }
      ).catch(() => {});
    }

    // Audit log
    const db = require('../../models');
    await db.AdminAuditLog.create({
      admin_id: req.auth.userId,
      action_type: 'support_email_sent',
      entity_type: 'email',
      entity_id: ticket_id || 0,
      module: 'support',
      severity: 'info',
      details: { to_email, to_name, subject, ticket_id },
      ip_address: getClientIp(req),
    }).catch(() => {});

    return res.success('Email sent successfully', { to: to_email, subject });
  } catch (e) {
    return next(e);
  }
}

/** Public web SDK fields for admin live support chat (same RTDB as mobile). */
async function getFirebaseClientConfig(req, res) {
  const databaseURL = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!databaseURL) {
    return res.success('Firebase client config', { configured: false });
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const apiKey =
    String(process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || '').trim() ||
    'firebase-api-key';

  return res.success('Firebase client config', {
    configured: true,
    databaseURL,
    apiKey,
    projectId: projectId || 'car-comfort',
    authDomain: String(process.env.FIREBASE_AUTH_DOMAIN || '').trim() || undefined,
    appId: String(process.env.FIREBASE_APP_ID || '').trim() || undefined,
  });
}

/**
 * Email history — query AdminAuditLog for support_email_sent entries.
 * Optionally filter by user_type (customer | driver) via the details.to_email domain
 * or by matching ticket's requester role.
 */
async function listEmailHistory(req, res, next) {
  try {
    const db = require('../../models');
    const { Op } = require('sequelize');
    const {
      page = 1,
      limit = 20,
      search,
      from_date,
      to_date,
      ticket_id,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = { action_type: 'support_email_sent' };

    if (from_date) where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(from_date) };
    if (to_date) {
      const end = new Date(to_date); end.setHours(23, 59, 59, 999);
      where.created_at = { ...(where.created_at || {}), [Op.lte]: end };
    }
    if (ticket_id) {
      where.entity_id = parseInt(ticket_id);
    }

    const result = await db.AdminAuditLog.findAndCountAll({
      where,
      include: [
        { model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    // Filter by search on to_email from details JSON
    let rows = result.rows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const d = r.details || {};
        return (
          (d.to_email || '').toLowerCase().includes(q) ||
          (d.to_name || '').toLowerCase().includes(q) ||
          (d.subject || '').toLowerCase().includes(q)
        );
      });
    }

    return res.success('Email history fetched', {
      rows: rows.map((r) => ({
        id: r.id,
        to_email: r.details?.to_email || '',
        to_name: r.details?.to_name || '',
        subject: r.details?.subject || '',
        ticket_id: r.details?.ticket_id || r.entity_id,
        sent_by: r.admin ? { id: r.admin.id, name: r.admin.name } : null,
        ip_address: r.ip_address,
        created_at: r.created_at,
      })),
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAnalytics,
  getLiveWidgets,
  getIssues,
  patchAssign,
  postInternalNote,
  postEscalate,
  notifySupportChat,
  getFirebaseClientConfig,
  sendEmailToCustomer,
  listEmailHistory,
  listFaqs,
  postFaq,
  patchFaq,
  deleteFaq,
  listFaqCategories,
  postFaqCategory,
  patchFaqReorder,
  saveSupportAttachment,
};
