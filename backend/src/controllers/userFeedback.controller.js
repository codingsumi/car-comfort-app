const supportTicketsService = require('../services/supportTickets.service');
const { sendSupportChatNotification } = require('../services/supportTicketNotify.service');
const platformReportsService = require('../services/platformReports.service');
const { HttpError } = require('../utils/httpError');
const db = require('../models');

function roleToUserType(role) {
  if (role === 'customer') return 'customer';
  if (role === 'driver') return 'driver';
  if (role === 'garage') return 'garage';
  return null;
}

async function createTicket(req, res, next) {
  try {
    const ut = roleToUserType(req.auth.role);
    if (!ut) throw new HttpError(403, 'Forbidden');
    const ticket = await supportTicketsService.createTicketFromUser({
      userId: req.auth.userId,
      userType: ut,
      subject: req.body.subject,
      initial_message: req.body.message,
    });
    return res.success('Ticket created', ticket, 201);
  } catch (e) {
    return next(e);
  }
}

async function listMyTickets(req, res, next) {
  try {
    const ut = roleToUserType(req.auth.role);
    if (!ut) throw new HttpError(403, 'Forbidden');
    const rows = await db.SupportTicket.findAll({
      where: { user_id: req.auth.userId, user_type: ut },
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: Math.min(50, Number(req.query.limit) || 20),
    });
    return res.success('Tickets', rows.map((r) => r.get({ plain: true })));
  } catch (e) {
    return next(e);
  }
}

async function getMyTicket(req, res, next) {
  try {
    const ut = roleToUserType(req.auth.role);
    if (!ut) throw new HttpError(403, 'Forbidden');
    const ticket = await db.SupportTicket.findOne({
      where: { id: req.params.id, user_id: req.auth.userId, user_type: ut },
    });
    if (!ticket) throw new HttpError(404, 'Ticket not found');
    const data = await supportTicketsService.getTicketById(ticket.id, {
      messagesPage: req.query.messages_page,
      messagesLimit: req.query.messages_limit,
    });
    const filteredMessages = (data.messages || []).filter((m) => !m.internal_note);
    return res.success('Ticket', {
      ticket: data.ticket,
      messages: filteredMessages,
      messages_pagination: data.messages_pagination,
    });
  } catch (e) {
    return next(e);
  }
}

async function replyMyTicket(req, res, next) {
  try {
    const ut = roleToUserType(req.auth.role);
    if (!ut) throw new HttpError(403, 'Forbidden');
    const ticket = await db.SupportTicket.findOne({
      where: { id: req.params.id, user_id: req.auth.userId, user_type: ut },
    });
    if (!ticket) throw new HttpError(404, 'Ticket not found');
    throw new HttpError(
      410,
      'Support chat is real time via Firebase. Send messages from the ticket chat screen in the app.'
    );
  } catch (e) {
    return next(e);
  }
}

async function submitReport(req, res, next) {
  try {
    const ut = roleToUserType(req.auth.role);
    if (!ut) throw new HttpError(403, 'Forbidden');
    const files = Array.isArray(req.files) ? req.files : [];
    const row = await platformReportsService.createReportFromUser(
      { ...req.body, priority: req.body.priority || 'medium' },
      req.auth.userId,
      { files, req }
    );
    return res.success('Report submitted', row, 201);
  } catch (e) {
    return next(e);
  }
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

module.exports = {
  createTicket,
  listMyTickets,
  getMyTicket,
  replyMyTicket,
  notifySupportChat,
  submitReport,
};
