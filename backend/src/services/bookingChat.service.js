'use strict';

const db = require('../models');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');
const { logger } = require('../config/logger');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { HttpError } = require('../utils/httpError');

const ACTIVE_CHAT_ROOT = 'booking_chats';
const CHAT_MEMBERS_ROOT = 'booking_chat_members';

function toId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isCompleted(booking) {
  return String(booking?.status || '').trim().toLowerCase() === 'completed';
}

function participantIds(booking) {
  return {
    customerId: toId(booking.customer_id) || toId(booking.user_id),
    driverId: toId(booking.assigned_driver_user_id) || toId(booking.provider_id),
  };
}

function participantRole(booking, userId) {
  const uid = toId(userId);
  const { customerId, driverId } = participantIds(booking);
  if (customerId && uid === customerId) return 'customer';
  if (driverId && uid === driverId) return 'driver';
  return null;
}

async function loadBookingForChat(bookingId) {
  const id = toId(bookingId);
  if (!id) throw new HttpError(400, 'booking id is invalid');

  const booking = await db.Booking.findByPk(id, {
    include: [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'profile'] },
      { model: db.User, as: 'assigned_driver', attributes: ['id', 'name', 'profile'] },
    ],
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  return booking;
}

function assertChatParticipant(booking, auth) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  const role = participantRole(booking, auth.userId);
  if (!role) throw new HttpError(403, 'You are not a participant for this booking chat');
  return role;
}

function avatarFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return '';
  return String(profile.profile_picture || profile.avatar || profile.image || '').trim();
}

function userPayload(user, fallbackId, fallbackRole) {
  return {
    id: String(user?.id || fallbackId || ''),
    name: String(user?.name || fallbackRole || 'User').trim(),
    image: avatarFromProfile(user?.profile),
    role: fallbackRole,
  };
}

function messagePreview(value) {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'Sent you a message';
  return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
}

async function isReceiverActiveInChat(bookingId, receiverId) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return false;
    const snapshot = await admin
      .database()
      .ref(`${ACTIVE_CHAT_ROOT}/${bookingId}/presence/${receiverId}/active`)
      .once('value');
    return snapshot.val() === true;
  } catch (err) {
    logger.warn('booking_chat_presence_check_failed', {
      bookingId,
      receiverId,
      message: err?.message,
    });
    return false;
  }
}

function messageListFromSnapshotValue(value) {
  const rawMessages = value?.messages && typeof value.messages === 'object'
    ? value.messages
    : value?.meta
      ? null
      : value;
  if (!rawMessages || typeof rawMessages !== 'object') return [];

  return Object.entries(rawMessages)
    .filter(([, message]) => message && typeof message === 'object')
    .map(([key, message]) => ({
      id: String(message.id || message.pushKey || key),
      message: String(message.message || message.msg || ''),
      type: String(message.type || 'text'),
      timestamp: Number(message.timestamp || message.timeStamp || 0),
      timezone: message.timezone ? String(message.timezone) : null,
      seen: Boolean(message.seen),
      isReply: Boolean(message.isReply),
      unreadCount: Number(message.unreadCount || 0),
      attachment: {
        audio: String(message.attachment?.audio || ''),
        image: String(message.attachment?.image || ''),
        thumbnail: String(message.attachment?.thumbnail || ''),
        video: String(message.attachment?.video || ''),
      },
      users: {
        receiverId: String(message.users?.receiverId || message.receiverId || ''),
        receiverImage: String(message.users?.receiverImage || ''),
        receiverName: String(message.users?.receiverName || ''),
        senderId: String(message.users?.senderId || message.senderId || ''),
        senderImage: String(message.users?.senderImage || ''),
        senderName: String(message.users?.senderName || ''),
      },
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function getBookingChatSession({ bookingId, auth }) {
  const admin = getFirebaseAdmin();
  if (!admin) throw new HttpError(503, 'Firebase chat is not configured');

  const booking = await loadBookingForChat(bookingId);
  const role = assertChatParticipant(booking, auth);
  if (isCompleted(booking)) {
    throw new HttpError(409, 'Booking is completed. Use chat transcript endpoint.');
  }

  const { customerId, driverId } = participantIds(booking);
  if (!customerId || !driverId) {
    throw new HttpError(409, 'Chat is available once a service provider is assigned');
  }

  const userId = String(auth.userId);
  const peerId = role === 'customer' ? driverId : customerId;
  const currentUser = role === 'customer'
    ? userPayload(booking.user, customerId, 'customer')
    : userPayload(booking.assigned_driver, driverId, 'driver');
  const peer = role === 'customer'
    ? userPayload(booking.assigned_driver, driverId, 'driver')
    : userPayload(booking.user, customerId, 'customer');

  const dbRef = admin.database();
  await dbRef.ref(`${CHAT_MEMBERS_ROOT}/${booking.id}/${customerId}`).set(true);
  await dbRef.ref(`${CHAT_MEMBERS_ROOT}/${booking.id}/${driverId}`).set(true);
  await dbRef.ref(`${ACTIVE_CHAT_ROOT}/${booking.id}/meta`).update({
    bookingId: String(booking.id),
    customerId: String(customerId),
    driverId: String(driverId),
    updatedAt: Date.now(),
  });

  const firebaseToken = await admin.auth().createCustomToken(userId, {
    role: String(auth.role || role),
  });

  return {
    booking_id: booking.id,
    status: booking.status,
    firebase_token: firebaseToken,
    database_url: process.env.FIREBASE_DATABASE_URL,
    rtdb_path: `${ACTIVE_CHAT_ROOT}/${booking.id}`,
    messages_path: `${ACTIVE_CHAT_ROOT}/${booking.id}/messages`,
    current_user: currentUser,
    peer,
    receiver_id: String(peerId),
  };
}

async function snapshotBookingChat({ bookingId, source = 'firebase_rtdb' }) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    logger.warn('booking_chat_snapshot_skipped_firebase_unconfigured', { bookingId });
    return null;
  }

  const booking = await loadBookingForChat(bookingId);
  const existing = await db.BookingChatTranscript.findOne({ where: { booking_id: booking.id } });
  if (existing) return existing;

  const chatRef = admin.database().ref(`${ACTIVE_CHAT_ROOT}/${booking.id}`);
  const snapshot = await chatRef.once('value');
  const messages = messageListFromSnapshotValue(snapshot.val());
  const capturedAt = new Date();

  const transcript = await db.BookingChatTranscript.create({
    booking_id: booking.id,
    message_count: messages.length,
    transcript_json: {
      booking_id: String(booking.id),
      messages,
    },
    source,
    captured_at: capturedAt,
  });

  await Promise.allSettled([
    chatRef.remove(),
    admin.database().ref(`${CHAT_MEMBERS_ROOT}/${booking.id}`).remove(),
  ]);

  logger.info('booking_chat_transcript_captured', {
    bookingId: booking.id,
    messageCount: messages.length,
  });

  return transcript;
}

async function captureBookingChatOnCompletion(bookingId) {
  try {
    return await snapshotBookingChat({ bookingId, source: 'firebase_rtdb_completion' });
  } catch (err) {
    logger.error('booking_chat_completion_snapshot_failed', {
      bookingId,
      message: err?.message,
      stack: err?.stack,
    });
    return null;
  }
}

async function getBookingChatTranscript({ bookingId, auth }) {
  const booking = await loadBookingForChat(bookingId);
  assertChatParticipant(booking, auth);
  if (!isCompleted(booking)) {
    throw new HttpError(409, 'Booking chat transcript is available after completion');
  }

  let transcript = await db.BookingChatTranscript.findOne({
    where: { booking_id: booking.id },
  });

  if (!transcript) {
    transcript = await snapshotBookingChat({
      bookingId: booking.id,
      source: 'firebase_rtdb_on_demand',
    });
  }

  const messages = Array.isArray(transcript?.transcript_json?.messages)
    ? transcript.transcript_json.messages
    : [];

  return {
    booking_id: booking.id,
    status: booking.status,
    message_count: transcript?.message_count ?? messages.length,
    captured_at: transcript?.captured_at || null,
    source: transcript?.source || null,
    messages,
  };
}

async function sendBookingChatNotification({
  bookingId,
  auth,
  messageId,
  message,
}) {
  const booking = await loadBookingForChat(bookingId);
  const role = assertChatParticipant(booking, auth);
  if (isCompleted(booking)) {
    throw new HttpError(409, 'Booking chat is completed');
  }

  const safeMessageId = String(messageId || '').trim();
  if (!safeMessageId) throw new HttpError(400, 'message_id is required');
  if (safeMessageId.length > 128) {
    throw new HttpError(400, 'message_id must be <= 128 chars');
  }

  const { customerId, driverId } = participantIds(booking);
  if (!customerId || !driverId) {
    throw new HttpError(409, 'Chat is available once a service provider is assigned');
  }

  const senderId = role === 'customer' ? customerId : driverId;
  const receiverId = role === 'customer' ? driverId : customerId;
  if (Number(auth.userId) !== Number(senderId)) {
    throw new HttpError(403, 'Invalid chat sender');
  }

  const receiverActive = await isReceiverActiveInChat(booking.id, receiverId);
  if (receiverActive) {
    return { skipped: true, reason: 'receiver_on_chat_page' };
  }

  const sender = role === 'customer'
    ? userPayload(booking.user, customerId, 'customer')
    : userPayload(booking.assigned_driver, driverId, 'driver');
  const receiverRole = role === 'customer' ? 'driver' : 'customer';
  const title = sender.name ? sender.name : 'New chat message';
  const body = messagePreview(message);
  const bookingCode = booking.booking_code ? String(booking.booking_code) : '';
  const deliveryKey = `booking_chat:${booking.id}:${safeMessageId}:${receiverId}`;
  const data = {
    kind: 'CHAT_MESSAGE',
    booking_id: String(booking.id),
    booking_code: bookingCode,
    message_id: safeMessageId,
    sender_id: String(senderId),
    sender_name: sender.name,
    sender_image: sender.image,
    receiver_id: String(receiverId),
    receiver_role: receiverRole,
    uniqueKey: deliveryKey,
  };

  const [notification, created] = await db.AppNotification.findOrCreate({
    where: { delivery_key: deliveryKey },
    defaults: {
      user_id: receiverId,
      booking_id: booking.id,
      notification_type: 'CHAT_MESSAGE',
      title,
      message: body,
      data,
      delivery_key: deliveryKey,
      sent_status: 'pending',
      push_result: null,
    },
  });

  if (!created) {
    return {
      notification: notification.get({ plain: true }),
      skipped: true,
      reason: 'duplicate_message_notification',
    };
  }

  let push;
  try {
    push = await sendPushToUser(receiverId, {
      title,
      body,
      data: {
        ...data,
        notification_id: String(notification.id),
      },
      idempotencyKey: deliveryKey,
    });
  } catch (err) {
    logger.error('booking_chat_push_failed', {
      bookingId: booking.id,
      messageId: safeMessageId,
      receiverId,
      message: err?.message,
      code: err?.code,
    });
    push = { sent: false, error: err?.code || err?.message || 'push_failed' };
  }

  await notification.update({
    sent_status: push?.skipped || push?.sent === false ? 'skipped' : 'sent',
    push_result: push,
  });

  return {
    notification: notification.get({ plain: true }),
    push,
  };
}

module.exports = {
  getBookingChatSession,
  getBookingChatTranscript,
  captureBookingChatOnCompletion,
  sendBookingChatNotification,
};
