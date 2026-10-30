const { Op } = require('sequelize');
const db = require('../models');
const { logger } = require('../config/logger');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');
const { buildBookingAcceptedCopy } = require('./bookingNotification.service');
const { getCustomerBookingConfirmedMessage } = require('../constants/bookingAfterBookingMessages');
const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');

function resolveBookingCustomerUserId(bookingPlain) {
  const cid = Number(bookingPlain?.customer_id || bookingPlain?.user_id || 0);
  return cid > 0 ? cid : null;
}

const UNDELIVERED_BOOKING_CONFIRMED_STATUSES = ['pending', 'skipped_no_device', 'failed'];

/**
 * Re-send BOOKING_CONFIRMED push when the device was not registered at payment time.
 */
async function retryUndeliveredBookingConfirmedPushes(userId) {
  const uid = Number(userId);
  if (!uid || !isOneSignalConfigured()) return { retried: 0, sent: 0 };

  const rows = await db.AppNotification.findAll({
    where: {
      user_id: uid,
      notification_type: 'BOOKING_CONFIRMED',
      sent_status: { [Op.in]: UNDELIVERED_BOOKING_CONFIRMED_STATUSES },
    },
    order: [['id', 'DESC']],
    limit: 5,
  });

  let sent = 0;
  for (const row of rows) {
    const deliveryKey =
      row.delivery_key ||
      `${row.booking_id}:BOOKING_CONFIRMED:user:${uid}`;
    const baseData =
      row.data && typeof row.data === 'object' ? { ...row.data } : {};
    try {
      const pushOutcome = await sendPushToUser(uid, {
        title: row.title,
        body: row.message,
        data: { ...baseData, notification_id: String(row.id) },
        idempotencyKey: deliveryKey,
      });
      if (pushOutcome?.skipped) {
        logger.info('booking_confirmed_push_retry_skipped', {
          userId: uid,
          notificationId: row.id,
          reason: pushOutcome.reason,
        });
        continue;
      }
      await row.update({ sent_status: 'sent', push_result: pushOutcome });
      sent += 1;
      logger.info('booking_confirmed_push_retry_sent', {
        userId: uid,
        notificationId: row.id,
        bookingId: row.booking_id,
      });
    } catch (err) {
      logger.warn('booking_confirmed_push_retry_failed', {
        userId: uid,
        notificationId: row.id,
        message: err?.message,
      });
    }
  }

  return { retried: rows.length, sent };
}

async function loadDriverDetailsForPayload(driverUserId) {
  const uid = Number(driverUserId);
  if (!uid) return null;
  const user = await db.User.findByPk(uid, { attributes: ['id', 'name', 'phone'] });
  if (!user) return { user_id: uid, name: null, profile_picture: null };
  const profile = await db.DriverProfile.findOne({
    where: { user_id: uid },
    attributes: ['profile_picture']
  });
  return {
    user_id: uid,
    name: user.name != null ? String(user.name) : null,
    profile_picture: profile?.profile_picture != null ? String(profile.profile_picture) : null
  };
}

/**
 * After payment confirms an on-demand booking: inbox + push with post-booking copy.
 * Idempotent per booking + customer via delivery_key.
 */
async function notifyCustomerBookingConfirmed({ bookingId, booking, userId }) {
  const b =
    booking && booking.id != null
      ? booking
      : bookingId
        ? await db.Booking.findByPk(Number(bookingId))
        : null;
  if (!b) return { skipped: true, reason: 'missing_booking' };

  const plain = typeof b.get === 'function' ? b.get({ plain: true }) : b;
  const bid = Number(plain.id);
  const customerId = userId ? Number(userId) : resolveBookingCustomerUserId(plain);
  if (!bid || !customerId) return { skipped: true, reason: 'missing_customer' };

  const docCopy = getCustomerBookingConfirmedMessage(plain.schedule_type);
  if (!docCopy) return { skipped: true, reason: 'no_post_booking_message' };

  const deliveryKey = `${bid}:BOOKING_CONFIRMED:user:${customerId}`;
  const baseData = {
    kind: 'BOOKING_CONFIRMED',
    booking_id: String(bid),
    uniqueKey: deliveryKey,
    booking_code: plain.booking_code != null ? String(plain.booking_code) : '',
    service_type: plain.service_type != null ? String(plain.service_type) : '',
  };

  let row;
  try {
    const [r, wasCreated] = await db.AppNotification.findOrCreate({
      where: { delivery_key: deliveryKey },
      defaults: {
        user_id: customerId,
        booking_id: bid,
        notification_type: 'BOOKING_CONFIRMED',
        title: docCopy.title,
        message: docCopy.body,
        data: baseData,
        is_read: false,
        sent_status: 'pending',
        push_result: null,
      },
    });
    row = r;

    if (row.sent_status === 'sent') {
      return { skipped: true, reason: 'already_delivered', notificationId: row.id };
    }

    await row.update({
      title: docCopy.title,
      message: docCopy.body,
      data: { ...(row.data && typeof row.data === 'object' ? row.data : {}), ...baseData },
      booking_id: bid,
      user_id: customerId,
      sent_status: 'pending',
      push_result: null,
    });
  } catch (err) {
    logger.error('booking_confirmed_notify_db_failed', {
      bookingId: bid,
      customerId,
      message: err?.message,
    });
    throw err;
  }

  let pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
  if (isOneSignalConfigured()) {
    try {
      pushOutcome = await sendPushToUser(customerId, {
        title: docCopy.title,
        body: docCopy.body,
        data: { ...baseData, notification_id: String(row.id) },
        idempotencyKey: deliveryKey,
      });
      const skipped = pushOutcome && pushOutcome.skipped === true;
      await row.update({
        sent_status: skipped ? 'skipped_no_device' : 'sent',
        push_result: pushOutcome,
      });
    } catch (err) {
      logger.error('booking_confirmed_notify_push_failed', {
        bookingId: bid,
        customerId,
        message: err?.message,
      });
      await row.update({
        sent_status: 'failed',
        push_result: { error: err?.message || String(err) },
      });
    }
  } else {
    await row.update({ sent_status: 'skipped_onesignal', push_result: pushOutcome });
  }

  emitToCustomer(customerId, 'booking_status_update', {
    booking_id: bid,
    booking_status: 'CONFIRMED',
    message: docCopy.body,
    updated_at: new Date().toISOString(),
  });

  return { ok: true, notificationId: row.id, push: pushOutcome };
}

/**
 * After driver accepts: persist inbox notification, send push (welcome-style), then realtime events.
 * Idempotent per booking + customer via delivery_key.
 */
async function notifyCustomerBookingAccepted({ bookingId, driverUserId }) {
  const bid = Number(bookingId);
  const did = Number(driverUserId);
  logger.info('booking_accepted_notify_start', { bookingId: bid, driverUserId: did });

  const booking = await db.Booking.findByPk(bid);
  if (!booking) {
    logger.error('booking_accepted_notify_missing_booking', { bookingId: bid, driverUserId: did });
    return { skipped: true, reason: 'missing_booking' };
  }

  const plain = booking.get({ plain: true });
  const customerId = resolveBookingCustomerUserId(plain);
  if (!customerId) {
    logger.error('booking_accepted_notify_missing_customer', {
      bookingId: bid,
      driverUserId: did,
      customer_id: plain.customer_id,
      user_id: plain.user_id
    });
    return { skipped: true, reason: 'missing_customer' };
  }

  await retryUndeliveredBookingConfirmedPushes(customerId);

  const { subject, message } = buildBookingAcceptedCopy({
    booking: plain
  });

  const deliveryKey = `${bid}:BOOKING_ACCEPTED:user:${customerId}`;
  const baseData = {
    kind: 'BOOKING_ACCEPTED',
    booking_id: String(bid),
    uniqueKey: deliveryKey,
    booking_code: plain.booking_code != null ? String(plain.booking_code) : '',
    service_type: plain.service_type != null ? String(plain.service_type) : ''
  };

  let row;
  let created;
  try {
    const [r, wasCreated] = await db.AppNotification.findOrCreate({
      where: { delivery_key: deliveryKey },
      defaults: {
        user_id: customerId,
        booking_id: bid,
        notification_type: 'BOOKING_ACCEPTED',
        title: subject,
        message,
        data: baseData,
        is_read: false,
        sent_status: 'pending',
        push_result: null
      }
    });
    row = r;
    created = wasCreated;

    if (row.sent_status === 'sent') {
      logger.info('booking_accepted_notify_idempotent_skip', {
        bookingId: bid,
        customerId,
        driverUserId: did,
        notificationId: row.id,
        sent_status: row.sent_status
      });
      return { skipped: true, reason: 'already_delivered', notificationId: row.id };
    }

    const mergedData = { ...(row.data && typeof row.data === 'object' ? row.data : {}), ...baseData };
    await row.update({
      title: subject,
      message,
      data: mergedData,
      booking_id: bid,
      user_id: customerId,
      sent_status: 'pending',
      push_result: null
    });
  } catch (err) {
    logger.error('booking_accepted_notify_db_failed', {
      bookingId: bid,
      customerId,
      driverUserId: did,
      message: err?.message,
      stack: err?.stack
    });
    throw err;
  }

  logger.info('booking_accepted_notify_db_saved', {
    bookingId: bid,
    customerId,
    driverUserId: did,
    notificationId: row.id,
    created
  });

  let pushOutcome;
  try {
    if (!isOneSignalConfigured()) {
      logger.warn('booking_accepted_notify_push_skipped_onesignal', { bookingId: bid, customerId });
      pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
      await row.update({
        sent_status: 'skipped_onesignal',
        push_result: pushOutcome
      });
    } else {
      logger.info('booking_accepted_notify_push_start', {
        bookingId: bid,
        customerId,
        driverUserId: did,
        notificationId: row.id
      });
      pushOutcome = await sendPushToUser(customerId, {
        title: subject,
        body: message,
        data: {
          ...baseData,
          notification_id: String(row.id)
        },
        idempotencyKey: deliveryKey
      });

      const skipped = pushOutcome && pushOutcome.skipped === true;
      await row.update({
        sent_status: skipped ? 'skipped_no_device' : 'sent',
        push_result: pushOutcome
      });
      logger.info('booking_accepted_notify_push_done', {
        bookingId: bid,
        customerId,
        driverUserId: did,
        notificationId: row.id,
        sent_status: skipped ? 'skipped_no_device' : 'sent',
        pushOutcome
      });
    }
  } catch (err) {
    logger.error('booking_accepted_notify_push_failed', {
      bookingId: bid,
      customerId,
      driverUserId: did,
      notificationId: row.id,
      message: err?.message,
      stack: err?.stack,
      code: err?.code
    });
    try {
      await row.update({
        sent_status: 'failed',
        push_result: {
          error: err?.message || String(err),
          code: err?.code,
          name: err?.name
        }
      });
    } catch (updateErr) {
      logger.error('booking_accepted_notify_push_failed_status_update_error', {
        bookingId: bid,
        notificationId: row.id,
        message: updateErr?.message,
        stack: updateErr?.stack
      });
    }
  }

  const driverDetails = await loadDriverDetailsForPayload(did || plain.assigned_driver_user_id);
  const updatedAt = new Date().toISOString();

  emitToCustomer(customerId, 'booking_status_update', {
    booking_id: bid,
    booking_status: 'ASSIGNED',
    message,
    driver: driverDetails,
    updated_at: updatedAt
  });

  logger.info('booking_accepted_notify_complete', {
    bookingId: bid,
    customerId,
    driverUserId: did,
    notificationId: row.id
  });

  return {
    ok: true,
    notificationId: row.id,
    customerId,
    push: pushOutcome
  };
}

/**
 * Realtime-only updates when driver updates dispatch tracking (ENROUTE / ARRIVED).
 */
async function notifyCustomerBookingDispatchStatus({ bookingId, driverUserId, dispatchStatus }) {
  const bid = Number(bookingId);
  const did = Number(driverUserId);
  const status = String(dispatchStatus || '').toUpperCase();

  logger.info('booking_dispatch_socket_start', { bookingId: bid, driverUserId: did, dispatchStatus: status });

  const booking = await db.Booking.findByPk(bid);
  if (!booking) {
    logger.error('booking_dispatch_socket_missing_booking', { bookingId: bid, driverUserId: did });
    return { skipped: true, reason: 'missing_booking' };
  }

  const plain = booking.get({ plain: true });
  const customerId = resolveBookingCustomerUserId(plain);
  if (!customerId) {
    logger.error('booking_dispatch_socket_missing_customer', {
      bookingId: bid,
      driverUserId: did,
      customer_id: plain.customer_id,
      user_id: plain.user_id
    });
    return { skipped: true, reason: 'missing_customer' };
  }

  const driverDetails = await loadDriverDetailsForPayload(did);
  const updatedAt = new Date().toISOString();

  const messageMap = {
    ENROUTE: 'Your service provider is on the way',
    ARRIVED: 'Your service provider has arrived at your location'
  };

  emitToCustomer(customerId, 'booking_status_update', {
    booking_id: bid,
    booking_status: plain.status != null ? String(plain.status).toUpperCase() : null,
    message: messageMap[status] || `Booking dispatch status: ${status}`,
    driver: driverDetails,
    updated_at: updatedAt
  });

  logger.info('booking_dispatch_socket_complete', { bookingId: bid, customerId, driverUserId: did, dispatchStatus: status });
  return { ok: true, customerId };
}

module.exports = {
  resolveBookingCustomerUserId,
  retryUndeliveredBookingConfirmedPushes,
  notifyCustomerBookingConfirmed,
  notifyCustomerBookingAccepted,
  notifyCustomerBookingDispatchStatus
};
