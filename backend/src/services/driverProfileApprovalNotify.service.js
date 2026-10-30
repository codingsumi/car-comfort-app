const db = require('../models');
const { logger } = require('../config/logger');
const { isOneSignalConfigured } = require('../config/onesignal');
const { sendPushToUser } = require('../modules/notifications/push.provider');

function buildApprovalCopy({ status, reason }) {
  if (status === 'approved') {
    return {
      type: 'DRIVER_PROFILE_APPROVED',
      title: 'Service provider profile approved',
      message:
        'Your service provider profile has been approved. You can now access the service provider dashboard.',
    };
  }

  const safeReason = String(reason || '').trim();
  return {
    type: 'DRIVER_PROFILE_REJECTED',
    title: 'Service provider profile rejected',
    message: safeReason
      ? `Your service provider profile was rejected. Reason: ${safeReason}`
      : 'Your service provider profile was rejected. Please contact support for more details.',
  };
}

async function notifyDriverProfileApprovalStatus({ driverUserId, status, reason = null, profile = null }) {
  const uid = Number(driverUserId);
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!uid || !['approved', 'rejected'].includes(normalizedStatus)) {
    return { skipped: true, reason: 'invalid_payload' };
  }

  const copy = buildApprovalCopy({ status: normalizedStatus, reason });
  const changedAt = profile?.updated_at || profile?.updatedAt || new Date();
  const deliveryKey = `driver_profile:${uid}:${normalizedStatus}:${new Date(changedAt).getTime()}`;
  const data = {
    kind: copy.type,
    approval_status: normalizedStatus,
    driver_user_id: String(uid),
    ...(reason ? { approval_reason: String(reason).trim() } : {}),
  };

  try {
    const [row] = await db.AppNotification.findOrCreate({
      where: { delivery_key: deliveryKey },
      defaults: {
        user_id: uid,
        booking_id: null,
        notification_type: copy.type,
        title: copy.title,
        message: copy.message,
        data,
        is_read: false,
        sent_status: 'pending',
        push_result: null,
      },
    });

    let pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
    if (isOneSignalConfigured()) {
      try {
        pushOutcome = await sendPushToUser(uid, {
          title: copy.title,
          body: copy.message,
          data: {
            ...data,
            notification_id: String(row.id),
            uniqueKey: deliveryKey,
          },
          idempotencyKey: deliveryKey,
        });
      } catch (err) {
        logger.warn('driver_profile_approval_push_failed', {
          userId: uid,
          status: normalizedStatus,
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
    logger.error('driver_profile_approval_notify_failed', {
      userId: uid,
      status: normalizedStatus,
      message: err?.message,
    });
    return { skipped: true, reason: err?.message || 'notification_failed' };
  }
}

module.exports = { notifyDriverProfileApprovalStatus };
