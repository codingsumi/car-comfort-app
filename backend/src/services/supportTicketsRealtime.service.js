'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');

const SUPPORT_CHAT_ROOT = 'support_chats';

function chatRef(ticketId) {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  return admin.database().ref(`${SUPPORT_CHAT_ROOT}/${ticketId}`);
}

function inferSenderRole(message, ticket) {
  const explicit = String(message.sender_role || '').trim().toLowerCase();
  if (['customer', 'driver', 'garage', 'admin'].includes(explicit)) return explicit;

  const senderId = Number(message.senderId || message.users?.senderId);
  if (senderId && Number(ticket.user_id) === senderId) {
    return String(ticket.user_type || 'customer').trim().toLowerCase() || 'customer';
  }
  if (senderId) return 'admin';
  return 'customer';
}

function messageListFromSnapshotValue(value) {
  const rawMessages =
    value?.messages && typeof value.messages === 'object' ? value.messages : null;
  if (!rawMessages || typeof rawMessages !== 'object') return [];

  return Object.entries(rawMessages)
    .filter(([, message]) => message && typeof message === 'object')
    .map(([key, message]) => ({
      id: String(message.id || message.pushKey || key),
      msg: String(message.message || message.msg || ''),
      type: String(message.type || 'text'),
      timestamp: Number(message.timestamp || message.timeStamp || 0),
      senderId: String(message.users?.senderId || message.senderId || ''),
      sender_role: message.sender_role ? String(message.sender_role) : '',
      senderName: String(message.users?.senderName || ''),
    }))
    .filter((m) => m.msg.trim().length > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function initSupportChatMeta(ticketPlain) {
  const ticketId = Number(ticketPlain?.id);
  if (!ticketId) return { skipped: true, reason: 'invalid_ticket' };

  const ref = chatRef(ticketId);
  if (!ref) {
    logger.warn('support_chat_meta_skipped_firebase_unconfigured', { ticketId });
    return { skipped: true, reason: 'firebase_unconfigured' };
  }

  await ref.child('meta').set({
    ticketId: String(ticketId),
    ticketNumber: String(ticketPlain.ticket_number || ''),
    userId: String(ticketPlain.user_id || ''),
    userType: String(ticketPlain.user_type || ''),
    status: String(ticketPlain.status || 'open'),
    chatLocked: false,
    updatedAt: Date.now(),
  });

  return { ok: true };
}

async function writeSupportChatMessage({
  ticketPlain,
  senderId,
  senderRole,
  message,
  senderName,
}) {
  const ticketId = Number(ticketPlain?.id);
  const bodyRaw = String(message || '').trim();
  if (!ticketId || !bodyRaw) return { skipped: true, reason: 'invalid_payload' };

  const ref = chatRef(ticketId);
  if (!ref) {
    logger.warn('support_chat_write_skipped_firebase_unconfigured', { ticketId });
    return { skipped: true, reason: 'firebase_unconfigured' };
  }

  const metaSnap = await ref.child('meta').once('value');
  if (metaSnap.val()?.chatLocked === true) {
    return { skipped: true, reason: 'chat_locked' };
  }

  const senderRoleNorm = String(senderRole || '').trim().toLowerCase();
  const senderIdStr = String(senderId || '').trim();
  const ticketUserId = String(ticketPlain.user_id || '').trim();
  const receiverId = senderRoleNorm === 'admin' ? ticketUserId : 'support';
  const timestamp = Date.now();
  const body = bodyRaw.length > 4000 ? bodyRaw.slice(0, 4000) : bodyRaw;

  const users = {
    senderId: senderIdStr,
    receiverId,
    senderName: senderName ? String(senderName) : senderRoleNorm,
    receiverName: senderRoleNorm === 'admin' ? 'User' : 'Support',
    senderImage: '',
    receiverImage: '',
  };

  const messageRef = ref.child('messages').push();
  const pushKey = messageRef.key;
  if (!pushKey) return { skipped: true, reason: 'push_failed' };

  const payload = {
    id: pushKey,
    pushKey,
    msg: body,
    message: body,
    type: 'text',
    timeStamp: String(timestamp),
    timestamp,
    senderId: senderIdStr,
    receiverId,
    sender_role: senderRoleNorm,
    seen: false,
    isReply: false,
    unreadCount: 0,
    timezone: null,
    attachment: { audio: '', image: '', thumbnail: '', video: '' },
    users,
  };

  await messageRef.set(payload);
  await ref.child('users').set(users);
  await ref.child('meta').update({ updatedAt: timestamp });

  return { ok: true, path: `${SUPPORT_CHAT_ROOT}/${ticketId}/messages/${pushKey}`, pushKey };
}

/**
 * Persist Firebase chat to support_messages, then delete the RTDB node.
 */
async function archiveSupportChatToDb(ticketId) {
  const id = Number(ticketId);
  if (!id) return { archived: 0, skipped: true, reason: 'invalid_ticket' };

  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('support_chat_archive_skipped_firebase_unconfigured', { ticketId: id });
    return { archived: 0, skipped: true, reason: 'firebase_unconfigured' };
  }

  const ticket = await db.SupportTicket.findByPk(id);
  if (!ticket) return { archived: 0, skipped: true, reason: 'ticket_not_found' };

  const ref = admin.database().ref(`${SUPPORT_CHAT_ROOT}/${id}`);
  const snapshot = await ref.once('value');
  const chatValue = snapshot.val();

  if (!chatValue) {
    return { archived: 0, skipped: true, reason: 'no_chat_data' };
  }

  await ref.child('meta').update({ chatLocked: true, updatedAt: Date.now() });

  const liveMessages = messageListFromSnapshotValue(chatValue);
  if (!liveMessages.length) {
    await ref.remove();
    return { archived: 0, deleted: true };
  }

  const rows = liveMessages.map((m) => ({
    ticket_id: id,
    sender_id: Number(m.senderId) || ticket.user_id,
    sender_role: inferSenderRole(m, ticket),
    message: m.msg,
    attachments: null,
    internal_note: false,
    created_at: m.timestamp ? new Date(m.timestamp) : new Date(),
    updated_at: m.timestamp ? new Date(m.timestamp) : new Date(),
  }));

  const transaction = await db.sequelize.transaction();
  try {
    await db.SupportMessage.bulkCreate(rows, { transaction });

    const last = rows[rows.length - 1];
    const preview = last.message.replace(/\s+/g, ' ').slice(0, 240);
    await ticket.update(
      {
        last_message_preview: preview,
        last_message_at: last.created_at,
      },
      { transaction }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await ref.remove();

  logger.info('support_chat_archived', { ticketId: id, messageCount: rows.length });

  return { archived: rows.length, deleted: true };
}

async function deleteSupportChatFromRtdb(ticketId) {
  const admin = getFirebaseAdmin();
  if (!admin) return { skipped: true };
  await admin.database().ref(`${SUPPORT_CHAT_ROOT}/${ticketId}`).remove();
  return { ok: true };
}

module.exports = {
  SUPPORT_CHAT_ROOT,
  initSupportChatMeta,
  writeSupportChatMessage,
  archiveSupportChatToDb,
  deleteSupportChatFromRtdb,
  messageListFromSnapshotValue,
};
