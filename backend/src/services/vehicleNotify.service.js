const db = require('../models');
const { logger } = require('../config/logger');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');
const { sendEmail } = require('./email.service');

async function notifyCustomerVehicleRemoved({ customerUserId, vehicleLabel, removalReason }) {
  const uid = Number(customerUserId);
  if (!uid) return { skipped: true, reason: 'no_user' };

  const deliveryKey = `vehicle_removed:user:${uid}:${Date.now()}`;
  const title = 'Vehicle removed from your account';
  const message = `Your vehicle (${vehicleLabel}) has been removed by support.${removalReason ? ` Reason: ${removalReason}` : ''}`;

  try {
    const [row] = await db.AppNotification.findOrCreate({
      where: { delivery_key: deliveryKey },
      defaults: {
        user_id: uid,
        booking_id: null,
        notification_type: 'VEHICLE_REMOVED',
        title,
        message,
        data: { kind: 'VEHICLE_REMOVED', vehicle_label: vehicleLabel },
        is_read: false,
        sent_status: 'pending',
        push_result: null
      }
    });

    let pushOutcome = { skipped: true, reason: 'not_attempted' };
    try {
      if (!isOneSignalConfigured()) {
        pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
      } else {
        pushOutcome = await sendPushToUser(uid, {
          title,
          body: message,
          data: { kind: 'VEHICLE_REMOVED' },
          idempotencyKey: deliveryKey
        });
      }
    } catch (e) {
      logger.error('vehicle_removed_push_failed', { userId: uid, message: e?.message });
      pushOutcome = { skipped: true, reason: e?.message || 'push_error' };
    }

    await row.update({
      sent_status: pushOutcome?.skipped ? 'skipped' : 'sent',
      push_result: pushOutcome
    });

    const user = await db.User.findByPk(uid, { attributes: ['email', 'name'] });
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        text: `${message}\n\nIf you believe this was a mistake, please contact support.`
      }).catch((err) => {
        logger.warn('vehicle_removed_email_failed', { userId: uid, message: err?.message });
      });
    }

    return { ok: true, notification_id: row.id, push: pushOutcome };
  } catch (e) {
    logger.error('vehicle_removed_notify_failed', { userId: uid, message: e?.message });
    return { skipped: true, reason: e?.message };
  }
}

async function notifySupportVehicleFlagged({ vehicleId, subject, body }) {
  const inbox = process.env.SUPPORT_INBOX_EMAIL || process.env.SUPPORT_ALERT_EMAIL;
  if (!inbox) {
    logger.info('support_vehicle_alert_skipped_no_email', { vehicleId, subject });
    return { skipped: true, reason: 'no_support_email' };
  }
  try {
    await sendEmail({
      to: inbox,
      subject: subject || `Vehicle alert #${vehicleId}`,
      text: body || `Vehicle ID: ${vehicleId}`
    });
    return { ok: true };
  } catch (e) {
    logger.warn('support_vehicle_alert_email_failed', { vehicleId, message: e?.message });
    return { skipped: true, reason: e?.message };
  }
}

async function notifyAdminsSuspiciousVehicle({ vehicleId, summary }) {
  const admins = await db.User.findAll({
    where: { role: 'admin', status: 'active' },
    attributes: ['id', 'email'],
    limit: 25
  });
  const emails = admins.map((a) => a.email).filter(Boolean);
  if (!emails.length) {
    logger.info('admin_vehicle_alert_no_recipients', { vehicleId });
    return { skipped: true };
  }
  const text = summary || `Review vehicle #${vehicleId} in the admin panel.`;
  for (const to of emails) {
    await sendEmail({
      to,
      subject: `[Car Comfort] Vehicle review required (#${vehicleId})`,
      text
    }).catch(() => {});
  }
  return { ok: true, count: emails.length };
}

module.exports = {
  notifyCustomerVehicleRemoved,
  notifySupportVehicleFlagged,
  notifyAdminsSuspiciousVehicle
};
