const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { retryUndeliveredBookingConfirmedPushes } = require('./bookingCustomerNotify.service');
const { logger } = require('../config/logger');

const PLATFORMS = new Set(['android', 'ios', 'web']);

function parsePage(query) {
  const p = Number.parseInt(String(query?.page || '1'), 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function parseLimit(query) {
  const l = Number.parseInt(String(query?.limit || '20'), 10);
  if (!Number.isFinite(l) || l < 1) return 20;
  return Math.min(l, 50);
}

async function registerDevice({ userId, onesignal_id, platform }) {
  const id = String(onesignal_id || '').trim();
  if (!id) throw new HttpError(400, 'onesignal_id is required');
  const p = String(platform || '').trim().toLowerCase();
  if (!PLATFORMS.has(p)) throw new HttpError(400, 'platform must be android, ios, or web');

  const uid = Number(userId);

  const device = await db.sequelize.transaction(async (transaction) => {
    const disconnectOtherOwners = async () => {
      const other = await db.UserDevice.findOne({
        where: { onesignal_id: id, user_id: { [Op.ne]: uid } },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (other) await other.destroy({ transaction });
    };

    const upsertForUser = async () => {
      let row = await db.UserDevice.findOne({
        where: { user_id: uid },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (row) {
        await row.update({ onesignal_id: id, platform: p, is_active: true }, { transaction });
        return row.get({ plain: true });
      }
      row = await db.UserDevice.create(
        {
          user_id: uid,
          onesignal_id: id,
          platform: p,
          is_active: true
        },
        { transaction }
      );
      return row.get({ plain: true });
    };

    await disconnectOtherOwners();

    try {
      return await upsertForUser();
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
      await disconnectOtherOwners();
      let row = await db.UserDevice.findOne({
        where: { user_id: uid },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (row) {
        await row.update({ onesignal_id: id, platform: p, is_active: true }, { transaction });
        return row.get({ plain: true });
      }
      row = await db.UserDevice.create(
        {
          user_id: uid,
          onesignal_id: id,
          platform: p,
          is_active: true
        },
        { transaction }
      );
      return row.get({ plain: true });
    }
  });

  retryUndeliveredBookingConfirmedPushes(uid).catch((err) => {
    logger.warn('booking_confirmed_push_retry_on_register_failed', {
      userId: uid,
      message: err?.message,
    });
  });

  return device;
}

/** Mark every stored OneSignal subscription inactive (e.g. on server-side logout). */
async function deactivateAllUserDevices(userId) {
  await db.UserDevice.update({ is_active: false }, { where: { user_id: Number(userId) } });
}

async function listNotifications({ userId, query }) {
  const page = parsePage(query);
  const limit = parseLimit(query);
  const offset = (page - 1) * limit;

  const { rows, count } = await db.AppNotification.findAndCountAll({
    where: { user_id: Number(userId) },
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    notifications: rows.map((r) => r.get({ plain: true })),
    pagination: { page, limit, total: count }
  };
}

async function deleteNotification({ userId, id }) {
  const nid = Number.parseInt(String(id), 10);
  if (!nid || nid < 1) throw new HttpError(400, 'Invalid id');

  const n = await db.AppNotification.destroy({
    where: { id: nid, user_id: Number(userId) }
  });
  if (!n) throw new HttpError(404, 'Notification not found');
  return { ok: true };
}

async function deleteAllNotifications({ userId }) {
  await db.AppNotification.destroy({ where: { user_id: Number(userId) } });
  return { ok: true };
}

async function sendWelcomeNotification({ userId, title, message }) {
  const uid = Number(userId);
  const safeTitle = String(title || '').trim();
  const safeMessage = String(message || '').trim();

  if (!safeTitle) throw new HttpError(400, 'title is required');
  if (!safeMessage) throw new HttpError(400, 'message is required');

  const device = await db.UserDevice.findOne({
    where: { user_id: uid, is_active: true },
    attributes: ['id', 'onesignal_id']
  });
  if (!device?.onesignal_id) {
    throw new HttpError(404, 'No active subscribed device found for this user');
  }

  const deliveryKey = `welcome:${uid}:${Date.now()}`;
  const notification = await db.AppNotification.create({
    user_id: uid,
    notification_type: 'WELCOME',
    title: safeTitle,
    message: safeMessage,
    data: { kind: 'WELCOME' },
    delivery_key: deliveryKey
  });
  logger.info('welcome_notification_db_stored', {
    userId: uid,
    notificationId: notification.id,
    deliveryKey
  });

  try {
    logger.info('welcome_notification_push_triggered', {
      userId: uid,
      notificationId: notification.id,
      deliveryKey
    });
    const push = await sendPushToUser(uid, {
      title: safeTitle,
      body: safeMessage,
      data: {
        kind: 'WELCOME',
        notification_id: String(notification.id),
        uniqueKey: deliveryKey
      },
      idempotencyKey: deliveryKey
    });

    return {
      notification: notification.get({ plain: true }),
      push
    };
  } catch (err) {
    logger.error('welcome_notification_push_failed_after_db_store', {
      userId: uid,
      notificationId: notification.id,
      deliveryKey,
      error: {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode || err?.response?.status,
        body: err?.body || err?.response?.body || err?.response?.data
      }
    });
    return {
      notification: notification.get({ plain: true }),
      push: {
        sent: false,
        error: err?.code || err?.message || 'push_failed'
      }
    };
  }
}

module.exports = {
  registerDevice,
  deactivateAllUserDevices,
  listNotifications,
  deleteNotification,
  deleteAllNotifications,
  sendWelcomeNotification
};
