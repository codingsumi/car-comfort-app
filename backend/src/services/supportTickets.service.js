const { Op } = require('sequelize');
const crypto = require('crypto');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sanitizePlainText } = require('../utils/userContentSanitize');
const { sendEmail } = require('./email.service');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');
const { logger } = require('../config/logger');
const {
  initSupportChatMeta,
  writeSupportChatMessage,
  archiveSupportChatToDb,
} = require('./supportTicketsRealtime.service');
const { notifyAdminsSupportTicketCreated } = require('./supportTicketNotify.service');

function nextTicketNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CC-SUP-${ymd}-${rand}`;
}

function normalizePriority(priority) {
  if (!priority) return undefined;
  if (priority === 'urgent') return 'urgent';
  if (priority === 'critical') return 'critical';
  return priority;
}

const CHAT_LOCKED_STATUSES = new Set(['resolved', 'closed']);

function isTicketChatLocked(status) {
  return CHAT_LOCKED_STATUSES.has(String(status || '').trim().toLowerCase());
}

async function notifyAdmins({ subject, text, excludeAdminId }) {
  const admins = await db.User.findAll({
    where: { role: 'admin', status: 'active' },
    attributes: ['id', 'email'],
    limit: 50, // guard against unbounded scan as admin count grows
  });
  for (const a of admins) {
    if (excludeAdminId && a.id === excludeAdminId) continue;
    if (a.email) {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({ to: a.email, subject, text }).catch(() => {});
    }
  }
}

async function listTicketsForAdmin(params = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    user_type,
    category,
    assigned_to,
    search,
    date_from,
    date_to,
    sort = 'created_at',
    order = 'desc',
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = normalizePriority(priority);
  if (user_type) where.user_type = user_type;
  if (category) where.category = category;
  if (assigned_to) where.assigned_to = assigned_to;
  if (date_from || date_to) {
    where.created_at = {
      ...(date_from ? { [Op.gte]: new Date(date_from) } : {}),
      ...(date_to ? { [Op.lte]: new Date(date_to) } : {}),
    };
  }
  if (search) {
    where[Op.or] = [
      { ticket_number: { [Op.like]: `%${search}%` } },
      { subject: { [Op.like]: `%${search}%` } },
      { last_message_preview: { [Op.like]: `%${search}%` } },
      { '$requester.name$': { [Op.like]: `%${search}%` } },
      { '$requester.email$': { [Op.like]: `%${search}%` } },
    ];
  }

  const validSorts = ['created_at', 'updated_at', 'priority', 'status', 'last_message_at'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';

  const { count, rows } = await db.SupportTicket.findAndCountAll({
    where,
    include: [
      { model: db.User, as: 'requester', attributes: ['id', 'name', 'email', 'role', 'status'] },
      { model: db.User, as: 'assignee', attributes: ['id', 'name', 'email'], required: false },
    ],
    order: [
      [sortField, order === 'asc' ? 'ASC' : 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limitNum,
    offset,
    distinct: true,
    subQuery: false,
  });

  return {
    tickets: rows.map((r) => r.get({ plain: true })),
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

async function getTicketById(id, { messagesPage = 1, messagesLimit = 50 } = {}) {
  const ticket = await db.SupportTicket.findByPk(id, {
    include: [
      { model: db.User, as: 'requester', attributes: { exclude: ['password', 'otp_code'] } },
      { model: db.User, as: 'assignee', attributes: ['id', 'name', 'email'], required: false },
      {
        model: db.Booking,
        as: 'linked_booking',
        attributes: ['id', 'booking_code', 'status', 'scheduled_at'],
        required: false,
      },
    ],
  });
  if (!ticket) throw new HttpError(404, 'Ticket not found');

  const msgPage = Math.max(1, parseInt(messagesPage, 10));
  const msgLimit = Math.min(100, Math.max(1, parseInt(messagesLimit, 10)));
  const msgOffset = (msgPage - 1) * msgLimit;

  const { count, rows } = await db.SupportMessage.findAndCountAll({
    where: { ticket_id: id },
    include: [{ model: db.User, as: 'sender', attributes: ['id', 'name', 'role'] }],
    order: [['created_at', 'ASC']],
    limit: msgLimit,
    offset: msgOffset,
  });

  const activity = await db.AdminAuditLog.findAll({
    where: { entity_type: 'support_ticket', entity_id: id },
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
    order: [['created_at', 'ASC']],
  });

  return {
    ticket: ticket.get({ plain: true }),
    messages: rows.map((r) => r.get({ plain: true })),
    messages_pagination: {
      total: count,
      page: msgPage,
      limit: msgLimit,
      total_pages: Math.ceil(count / msgLimit),
    },
    activity: activity.map((a) => a.get({ plain: true })),
  };
}

async function appendMessage(ticketId, { senderId, senderRole, message, attachments, internal_note }, adminCtx) {
  const ticket = await db.SupportTicket.findByPk(ticketId);
  if (!ticket) throw new HttpError(404, 'Ticket not found');

  if (!internal_note) {
    throw new HttpError(
      410,
      'Support chat messages are sent in real time via Firebase. Use the live chat UI or the mobile app.'
    );
  }

  const body = sanitizePlainText(message, { maxLength: 20000 });
  if (!body) throw new HttpError(400, 'Message is required');

  const msg = await db.SupportMessage.create({
    ticket_id: ticketId,
    sender_id: senderId,
    sender_role: senderRole,
    message: body,
    attachments: attachments || null,
    internal_note: Boolean(internal_note),
  });

  const preview = body.replace(/\s+/g, ' ').slice(0, 240);

  await ticket.update({
    last_message_preview: preview,
    last_message_at: new Date(),
  });

  if (adminCtx) {
    await db.AdminAuditLog.create({
      admin_id: adminCtx.adminId,
      action_type: internal_note ? 'ticket_internal_note' : 'ticket_reply',
      entity_type: 'support_ticket',
      entity_id: ticketId,
      details: { message_id: msg.id },
      ip_address: adminCtx.ipAddress,
    });
  }

  const loaded = await msg.reload({
    include: [{ model: db.User, as: 'sender', attributes: ['id', 'name', 'role'] }],
  });

  return loaded;
}

async function updateTicketStatus(id, payload, adminCtx) {
  const ticket = await db.SupportTicket.findByPk(id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');

  const prev = ticket.get({ plain: true });
  const updates = {};
  if (payload.status) {
    updates.status = payload.status;
    if (payload.status === 'escalated' && !ticket.escalated_at) {
      updates.escalated_at = new Date();
    }
    if (['resolved', 'closed'].includes(payload.status)) {
      await archiveSupportChatToDb(id).catch((err) => {
        logger.error('support_chat_archive_failed', {
          ticketId: id,
          message: err?.message,
        });
      });
      const user = await db.User.findByPk(ticket.user_id, { attributes: ['id', 'email', 'name'] });
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `Ticket ${ticket.ticket_number} resolved`,
          text: `Hello ${user.name || ''},\n\nYour support ticket ${ticket.ticket_number} has been marked as ${payload.status}.\n`,
        }).catch(() => {});
      }
      if (isOneSignalConfigured()) {
        await sendPushToUser(ticket.user_id, {
          title: 'Support ticket resolved',
          body: `Your ticket ${ticket.ticket_number} is now ${payload.status}.`,
          data: { kind: 'SUPPORT_TICKET_RESOLVED', ticket_id: String(id) },
          idempotencyKey: `support:${id}:resolved:${payload.status}`,
        }).catch((err) => logger.warn('support_resolve_push_failed', { message: err?.message }));
      }
    }
  }
  if (payload.priority) updates.priority = normalizePriority(payload.priority);
  if (payload.category) updates.category = payload.category;
  if (payload.assigned_to !== undefined) updates.assigned_to = payload.assigned_to || null;

  await ticket.update(updates);

  if (payload.status === 'open' && ['resolved', 'closed'].includes(String(prev.status || ''))) {
    const plain = ticket.get({ plain: true });
    await initSupportChatMeta({ ...plain, status: 'open' }).catch((err) => {
      logger.warn('support_chat_reopen_init_failed', { ticketId: id, message: err?.message });
    });
  }

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'ticket_status_updated',
    entity_type: 'support_ticket',
    entity_id: id,
    details: { previous: prev, updates },
    ip_address: adminCtx.ipAddress,
  });

  return ticket.reload({
    include: [
      { model: db.User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
      { model: db.User, as: 'assignee', attributes: ['id', 'name'], required: false },
    ],
  });
}

async function assignTicket(id, { assigned_to, strategy }, adminCtx) {
  const ticket = await db.SupportTicket.findByPk(id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');

  let assigneeId = assigned_to || null;

  if (!assigneeId && strategy === 'round_robin') {
    const admins = await db.User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id'],
      order: [['id', 'ASC']],
      limit: 50,
    });
    if (admins.length) {
      const counts = await db.SupportTicket.findAll({
        attributes: ['assigned_to', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'open_count']],
        where: { assigned_to: { [Op.ne]: null }, status: { [Op.in]: ['open', 'pending', 'in_progress', 'waiting_for_user', 'escalated'] } },
        group: ['assigned_to'],
        raw: true,
      });
      const countMap = Object.fromEntries(counts.map((c) => [c.assigned_to, Number(c.open_count)]));
      assigneeId = admins.reduce((best, a) => {
        const c = countMap[a.id] || 0;
        const bestC = countMap[best.id] || 0;
        return c < bestC ? a : best;
      }).id;
    }
  } else if (!assigneeId && strategy === 'priority') {
    const admins = await db.User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id'],
      order: [['id', 'ASC']],
      limit: 50,
    });
    assigneeId = admins[0]?.id || null;
    if (['urgent', 'critical', 'high'].includes(ticket.priority) && admins.length > 1) {
      assigneeId = admins[0].id;
    }
  }

  const prev = ticket.get({ plain: true });
  await ticket.update({ assigned_to: assigneeId, status: ticket.status === 'open' ? 'in_progress' : ticket.status });

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'ticket_assigned',
    entity_type: 'support_ticket',
    entity_id: id,
    details: { previous: prev, assigned_to: assigneeId, strategy: strategy || 'manual' },
    ip_address: adminCtx.ipAddress,
  });

  if (assigneeId) {
    const assignee = await db.User.findByPk(assigneeId, { attributes: ['email', 'name'] });
    if (assignee?.email) {
      await sendEmail({
        to: assignee.email,
        subject: `[Car Comfort] Ticket assigned: ${ticket.ticket_number}`,
        text: `You have been assigned ticket ${ticket.ticket_number}.\nSubject: ${ticket.subject}\nPriority: ${ticket.priority}\n`,
      }).catch(() => {});
    }
  }

  return ticket.reload({
    include: [
      { model: db.User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
      { model: db.User, as: 'assignee', attributes: ['id', 'name', 'email'], required: false },
    ],
  });
}

async function escalateTicket(id, adminCtx) {
  return updateTicketStatus(id, { status: 'escalated' }, adminCtx);
}

async function addInternalNote(ticketId, { note }, adminCtx) {
  return appendMessage(
    ticketId,
    {
      senderId: adminCtx.adminId,
      senderRole: 'admin',
      message: note,
      attachments: null,
      internal_note: true,
    },
    adminCtx
  );
}

async function createTicketFromUser({ userId, userType, subject, initial_message }) {
  const sub = sanitizePlainText(subject, { maxLength: 255 });
  const msg = sanitizePlainText(initial_message, { maxLength: 20000 });
  if (!sub || !msg) throw new HttpError(400, 'Subject and message are required');

  const ticket = await db.SupportTicket.create({
    ticket_number: nextTicketNumber(),
    user_id: userId,
    user_type: userType,
    subject: sub,
    status: 'open',
    priority: 'medium',
    last_message_preview: msg.replace(/\s+/g, ' ').slice(0, 240),
    last_message_at: new Date(),
  });

  const ticketPlain = ticket.get({ plain: true });
  const requester = await db.User.findByPk(userId, { attributes: ['id', 'name'] });

  await initSupportChatMeta(ticketPlain);
  await writeSupportChatMessage({
    ticketPlain,
    senderId: userId,
    senderRole: userType,
    message: msg,
    senderName: requester?.name || userType,
  });

  void notifyAdminsSupportTicketCreated({
    ticket: ticketPlain,
    requesterName: requester?.name || userType,
    initialMessage: msg,
  }).catch((err) => {
    logger.warn('support_ticket_created_notify_failed', {
      ticketId: ticket.id,
      message: err?.message,
    });
  });

  return ticket;
}

module.exports = {
  listTicketsForAdmin,
  getTicketById,
  appendMessage,
  updateTicketStatus,
  assignTicket,
  escalateTicket,
  addInternalNote,
  createTicketFromUser,
  nextTicketNumber,
  notifyAdmins,
};
