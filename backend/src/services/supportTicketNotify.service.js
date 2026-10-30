'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { HttpError } = require('../utils/httpError');
const { isOneSignalConfigured } = require('../config/onesignal');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { sendEmail } = require('./email.service');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');
const { SUPPORT_CHAT_ROOT } = require('./supportTicketsRealtime.service');

const CHAT_LOCKED_STATUSES = new Set(['resolved', 'closed']);

function isTicketChatLocked(status) {
  return CHAT_LOCKED_STATUSES.has(String(status || '').trim().toLowerCase());
}

function messagePreview(value) {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'New message';
  return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
}

async function isUserActiveOnSupportChat(ticketId, userId) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return false;
    const snapshot = await admin
      .database()
      .ref(`${SUPPORT_CHAT_ROOT}/${ticketId}/presence/${userId}/active`)
      .once('value');
    return snapshot.val() === true;
  } catch (err) {
    logger.warn('support_chat_presence_check_failed', {
      ticketId,
      userId,
      message: err?.message,
    });
    return false;
  }
}

async function persistAndPushToUser({
  userId,
  deliveryKey,
  notificationType,
  title,
  message,
  data,
}) {
  const uid = Number(userId);
  if (!uid || !deliveryKey) return { skipped: true, reason: 'invalid_payload' };

  const payload = {
    ...(data && typeof data === 'object' ? data : {}),
    kind: data?.kind || notificationType,
  };

  try {
    const [row, created] = await db.AppNotification.findOrCreate({
      where: { delivery_key: String(deliveryKey) },
      defaults: {
        user_id: uid,
        booking_id: null,
        notification_type: String(notificationType),
        title: String(title || ''),
        message: String(message || ''),
        data: payload,
        is_read: false,
        sent_status: 'pending',
        push_result: null,
      },
    });

    if (!created) {
      return { ok: true, notification_id: row.id, skipped: true, reason: 'duplicate' };
    }

    let pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
    if (isOneSignalConfigured()) {
      try {
        pushOutcome = await sendPushToUser(uid, {
          title: String(title || 'Car Comfort'),
          body: String(message || ''),
          data: {
            ...payload,
            notification_id: String(row.id),
            uniqueKey: String(deliveryKey),
          },
          idempotencyKey: String(deliveryKey),
        });
      } catch (err) {
        logger.warn('support_ticket_push_failed', {
          userId: uid,
          notificationType,
          deliveryKey,
          message: err?.message,
        });
        pushOutcome = { skipped: true, reason: err?.message || 'push_failed' };
      }
    }

    await row.update({
      sent_status: pushOutcome?.skipped ? 'skipped' : 'sent',
      push_result: pushOutcome,
    });

    return { ok: true, notification_id: row.id, push: pushOutcome };
  } catch (err) {
    logger.error('support_ticket_notify_failed', {
      userId: uid,
      notificationType,
      deliveryKey,
      message: err?.message,
    });
    return { skipped: true, reason: err?.message || 'notification_failed' };
  }
}

async function listActiveAdmins() {
  return db.User.findAll({
    where: { role: 'admin', status: 'active' },
    attributes: ['id', 'email', 'name'],
    limit: 50,
  });
}

async function notifyAdminsSupportTicketCreated({ ticket, requesterName, initialMessage }) {
  const ticketId = Number(ticket?.id);
  if (!ticketId) return { skipped: true, reason: 'invalid_ticket' };

  const admins = await listActiveAdmins();
  const preview = messagePreview(initialMessage);
  const requesterLabel = requesterName ? String(requesterName).trim() : 'A user';
  const title = 'New support ticket';
  const body = `${ticket.ticket_number}: ${ticket.subject}`;
  const emailSubject = `[Car Comfort] New support ticket ${ticket.ticket_number}`;
  const emailText = `A new support ticket was opened by ${requesterLabel}.\n\nTicket: ${ticket.ticket_number}\nSubject: ${ticket.subject}\n\n---\n${preview}\n`;

  const results = [];
  for (const admin of admins) {
    // eslint-disable-next-line no-await-in-loop
    const result = await persistAndPushToUser({
      userId: admin.id,
      deliveryKey: `support:${ticketId}:created:admin:${admin.id}`,
      notificationType: 'SUPPORT_TICKET_CREATED',
      title,
      message: body,
      data: {
        kind: 'SUPPORT_TICKET_CREATED',
        ticket_id: String(ticketId),
        ticket_number: String(ticket.ticket_number || ''),
      },
    });
    results.push(result);

    if (admin.email) {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({ to: admin.email, subject: emailSubject, text: emailText }).catch(() => {});
    }
  }

  return { ok: true, notified: results.length };
}

async function notifyAdminsSupportUserMessage({
  ticket,
  messageId,
  message,
  senderName,
  excludeAdminId,
}) {
  const ticketId = Number(ticket?.id);
  const safeMessageId = String(messageId || '').trim();
  if (!ticketId || !safeMessageId) return { skipped: true, reason: 'invalid_payload' };

  const admins = await listActiveAdmins();
  const preview = messagePreview(message);
  const senderLabel = senderName ? String(senderName).trim() : 'User';
  const title = 'Support ticket update';
  const body = `${ticket.ticket_number}: ${preview}`;

  const results = [];
  for (const admin of admins) {
    if (excludeAdminId && Number(admin.id) === Number(excludeAdminId)) continue;

    // eslint-disable-next-line no-await-in-loop
    const onChat = await isUserActiveOnSupportChat(ticketId, admin.id);
    if (onChat) {
      results.push({ skipped: true, reason: 'admin_on_chat_page', adminId: admin.id });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await persistAndPushToUser({
      userId: admin.id,
      deliveryKey: `support:${ticketId}:msg:${safeMessageId}:admin:${admin.id}`,
      notificationType: 'SUPPORT_TICKET_MESSAGE',
      title,
      message: body,
      data: {
        kind: 'SUPPORT_TICKET_MESSAGE',
        ticket_id: String(ticketId),
        ticket_number: String(ticket.ticket_number || ''),
        message_id: safeMessageId,
        sender_name: senderLabel,
      },
    });
    results.push(result);

    if (admin.email) {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        to: admin.email,
        subject: `[Car Comfort] User replied on ${ticket.ticket_number}`,
        text: `${senderLabel} sent a message on ticket ${ticket.ticket_number}.\n\nSubject: ${ticket.subject}\n\n---\n${preview}\n`,
      }).catch(() => {});
    }
  }

  return { ok: true, notified: results.length };
}

async function notifyUserSupportAdminReply({ ticket, messageId, message, adminName }) {
  const ticketId = Number(ticket?.id);
  const userId = Number(ticket?.user_id);
  const safeMessageId = String(messageId || '').trim();
  if (!ticketId || !userId || !safeMessageId) return { skipped: true, reason: 'invalid_payload' };

  const onChat = await isUserActiveOnSupportChat(ticketId, userId);
  if (onChat) {
    return { skipped: true, reason: 'user_on_chat_page' };
  }

  const preview = messagePreview(message);
  const title = 'Support replied';
  const body = `Your ticket ${ticket.ticket_number}: ${preview}`;

  const result = await persistAndPushToUser({
    userId,
    deliveryKey: `support:${ticketId}:admin_reply:${safeMessageId}`,
    notificationType: 'SUPPORT_TICKET_REPLY',
    title,
    message: body,
    data: {
      kind: 'SUPPORT_TICKET_REPLY',
      ticket_id: String(ticketId),
      ticket_number: String(ticket.ticket_number || ''),
      message_id: safeMessageId,
      admin_name: adminName ? String(adminName) : 'Support',
    },
  });

  const user = await db.User.findByPk(userId, { attributes: ['id', 'email', 'name'] });
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `Re: ${ticket.subject} (${ticket.ticket_number})`,
      text: `Hello ${user.name || ''},\n\nOur support team posted an update on your ticket ${ticket.ticket_number}.\n\n---\n${preview}\n`,
    }).catch(() => {});
  }

  return result;
}

async function sendSupportChatNotification({ ticketId, auth, messageId, message }) {
  const id = Number(ticketId);
  if (!id) throw new HttpError(400, 'ticket id is invalid');

  const ticket = await db.SupportTicket.findByPk(id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  if (isTicketChatLocked(ticket.status)) {
    throw new HttpError(409, 'This support ticket is closed');
  }

  const safeMessageId = String(messageId || '').trim();
  if (!safeMessageId) throw new HttpError(400, 'message_id is required');
  if (safeMessageId.length > 128) {
    throw new HttpError(400, 'message_id must be <= 128 chars');
  }

  const role = String(auth?.role || '').trim().toLowerCase();
  const authUserId = Number(auth?.userId);

  if (role === 'admin') {
    const admin = await db.User.findByPk(authUserId, { attributes: ['id', 'name'] });
    return notifyUserSupportAdminReply({
      ticket: ticket.get({ plain: true }),
      messageId: safeMessageId,
      message,
      adminName: admin?.name || 'Support',
    });
  }

  const ut =
    role === 'customer' ? 'customer' : role === 'driver' ? 'driver' : role === 'garage' ? 'garage' : null;
  if (!ut) throw new HttpError(403, 'Forbidden');

  if (Number(ticket.user_id) !== authUserId || String(ticket.user_type) !== ut) {
    throw new HttpError(403, 'You do not have access to this ticket');
  }

  const sender = await db.User.findByPk(authUserId, { attributes: ['id', 'name'] });

  return notifyAdminsSupportUserMessage({
    ticket: ticket.get({ plain: true }),
    messageId: safeMessageId,
    message,
    senderName: sender?.name || ut,
  });
}

module.exports = {
  notifyAdminsSupportTicketCreated,
  notifyAdminsSupportUserMessage,
  notifyUserSupportAdminReply,
  sendSupportChatNotification,
};
