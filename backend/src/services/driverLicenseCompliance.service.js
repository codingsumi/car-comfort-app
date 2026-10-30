const { Op } = require('sequelize');
const db = require('../models');
const { logger } = require('../config/logger');
const { isOneSignalConfigured } = require('../config/onesignal');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const {
  LICENSE_EXPIRED_SUSPENSION_REASON,
  LICENSE_EXPIRY_WARNING_MILESTONES,
  pickLicenseExpirationFromStepData,
  isLicenseExpired,
  isLicenseExpiringSoon,
  parseIsoDate,
  daysUntilExpiration,
} = require('../utils/driverPersonalInfo');

function normalizeWarningsSent(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  return [];
}

function buildLicenseExpiryWarningCopy({ daysRemaining, expirationYmd }) {
  const suspendNote =
    'Your account will be suspended and you will not be able to accept new service requests until your license is renewed.';
  const dateLabel = expirationYmd;

  if (daysRemaining === 30) {
    return {
      title: 'Driver license expiring in 1 month',
      message: `Your driver license expires on ${dateLabel}. ${suspendNote}`,
      milestoneKey: '30',
      pushType: 'driver_license_expiring',
    };
  }
  if (daysRemaining === 15) {
    return {
      title: 'Driver license expiring in 15 days',
      message: `Your driver license expires on ${dateLabel}. ${suspendNote}`,
      milestoneKey: '15',
      pushType: 'driver_license_expiring',
    };
  }
  if (daysRemaining === 1) {
    return {
      title: 'Driver license expires tomorrow',
      message: `Your driver license expires tomorrow (${dateLabel}). ${suspendNote}`,
      milestoneKey: '1',
      pushType: 'driver_license_expiring',
    };
  }
  if (daysRemaining === 0) {
    return {
      title: 'Driver license expires today',
      message: `Your driver license expires today (${dateLabel}). Upload a renewed license now or your account will be suspended.`,
      milestoneKey: '0',
      pushType: 'driver_license_expiring',
    };
  }

  return {
    title: 'Driver license expiring soon',
    message: `Your driver license expires on ${dateLabel}. ${suspendNote}`,
    milestoneKey: String(daysRemaining),
    pushType: 'driver_license_expiring',
  };
}

function isDriverLicenseSuspendedUser(user) {
  return (
    user?.status === 'suspended' &&
    user?.suspended_reason === LICENSE_EXPIRED_SUSPENSION_REASON
  );
}

function resolveDriverLicenseExpirationYmd(profile) {
  if (!profile) return null;
  const fromColumn = parseIsoDate(profile.drivers_license_expiration_date);
  if (fromColumn) {
    return String(profile.drivers_license_expiration_date).trim().slice(0, 10);
  }
  const fromStep = pickLicenseExpirationFromStepData(profile);
  return fromStep ? fromStep.toISOString().slice(0, 10) : null;
}

function resolveDriverLicenseExpirationDate(profile) {
  return parseIsoDate(resolveDriverLicenseExpirationYmd(profile));
}

function buildDriverLicenseComplianceStatus(user, profile) {
  const expirationYmd = resolveDriverLicenseExpirationYmd(profile);
  const expiration = parseIsoDate(expirationYmd);
  const daysRemaining = daysUntilExpiration(expiration);
  const expired = expiration ? isLicenseExpired(expiration) : false;
  const hold =
    !!profile?.license_hold_active || isDriverLicenseSuspendedUser(user);

  return {
    drivers_license_expiration_date: expirationYmd,
    license_hold_active: hold,
    is_license_expired: expired,
    license_days_until_expiration: daysRemaining,
    is_license_expiring_soon:
      !hold && !expired && expiration
        ? isLicenseExpiringSoon(expiration, 30)
        : false,
    can_accept_new_bookings: !hold && !expired,
  };
}

/**
 * Sync expiration from step_data, suspend if expired, return fresh user + profile.
 */
async function ensureDriverLicenseComplianceForUser(userId) {
  const user = await db.User.findOne({
    where: { id: userId, role: 'driver' },
  });
  if (!user) return null;

  let profile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!profile) return null;

  profile = await syncDriverLicenseExpirationFromStepData(profile);

  const expiration = resolveDriverLicenseExpirationDate(profile);
  if (expiration && isLicenseExpired(expiration)) {
    const needsEnforcement =
      !profile.license_hold_active || user.status === 'active';
    if (needsEnforcement) {
      const notify = user.status === 'active' && !profile.license_hold_active;
      await applyLicenseHoldForUser(user, profile);
      if (notify) {
        await notifyLicenseExpired(user, expiration);
      }
      await user.reload();
      profile = await db.DriverProfile.findByPk(profile.id);
    }
  }

  return { user, profile };
}

async function syncDriverLicenseExpirationFromStepData(profile) {
  if (!profile) return profile;

  const expiration = pickLicenseExpirationFromStepData(profile);
  const expirationYmd = expiration
    ? expiration.toISOString().slice(0, 10)
    : null;

  if (profile.drivers_license_expiration_date === expirationYmd) {
    return profile;
  }

  await profile.update({
    drivers_license_expiration_date: expirationYmd,
    license_expiry_warnings_sent: [],
    license_expiry_warning_sent_at: null,
  });
  return profile;
}

async function clearLicenseHoldForUser(user, profile) {
  if (!user || !profile?.license_hold_active) return;

  await profile.update({
    license_hold_active: false,
    license_expiry_warning_sent_at: null,
    license_expiry_warnings_sent: [],
  });

  if (user.role === 'driver' && isDriverLicenseSuspendedUser(user)) {
    await user.update({
      status: 'active',
      suspended_reason: null,
      suspended_at: null,
    });
  }
}

async function applyLicenseHoldForUser(user, profile) {
  if (!user || !profile) return;

  await profile.update({ license_hold_active: true });

  if (user.status === 'active') {
    await user.update({
      status: 'suspended',
      suspended_reason: LICENSE_EXPIRED_SUSPENSION_REASON,
      suspended_at: new Date(),
      deactivated_at: null,
    });
  }
}

async function persistLicenseExpiryInboxNotification({
  userId,
  title,
  message,
  notificationType,
  deliveryKey,
  data,
}) {
  try {
    const [row] = await db.AppNotification.findOrCreate({
      where: { delivery_key: deliveryKey },
      defaults: {
        user_id: userId,
        booking_id: null,
        notification_type: notificationType,
        title,
        message,
        data,
        is_read: false,
        sent_status: 'pending',
        push_result: null,
      },
    });

    let pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
    if (isOneSignalConfigured()) {
      try {
        pushOutcome = await sendPushToUser(userId, {
          title,
          body: message,
          data: {
            ...data,
            notification_id: String(row.id),
            uniqueKey: deliveryKey,
          },
          idempotencyKey: deliveryKey,
        });
      } catch (err) {
        logger.warn('driver_license_compliance_push_failed', {
          userId,
          notificationType,
          message: err?.message,
        });
        pushOutcome = { skipped: true, reason: err?.message || 'push_failed' };
      }
    }

    await row.update({
      sent_status: pushOutcome.skipped ? 'skipped' : 'sent',
      push_result: pushOutcome,
    });
  } catch (err) {
    logger.warn('driver_license_compliance_inbox_failed', {
      userId,
      notificationType,
      message: err?.message,
    });
  }
}

async function notifyLicenseExpiringSoon(user, expirationDate, daysRemaining) {
  const ymd = expirationDate.toISOString().slice(0, 10);
  const copy = buildLicenseExpiryWarningCopy({
    daysRemaining,
    expirationYmd: ymd,
  });
  const deliveryKey = `driver_license_expiring:${user.id}:${ymd}:${copy.milestoneKey}`;

  await persistLicenseExpiryInboxNotification({
    userId: user.id,
    title: copy.title,
    message: copy.message,
    notificationType: copy.pushType,
    deliveryKey,
    data: {
      kind: 'DRIVER_LICENSE_EXPIRING',
      type: copy.pushType,
      expiration_date: ymd,
      days_remaining: String(daysRemaining),
      milestone_days: copy.milestoneKey,
    },
  });
}

async function notifyLicenseExpired(user, expirationDate) {
  const ymd = expirationDate ? expirationDate.toISOString().slice(0, 10) : null;
  const message =
    'Your driver license has expired. Your account is suspended until you upload a renewed license. You cannot accept new service requests.';
  const deliveryKey = `driver_license_expired:${user.id}:${ymd || 'unknown'}`;

  await persistLicenseExpiryInboxNotification({
    userId: user.id,
    title: 'Driver license expired — account suspended',
    message,
    notificationType: 'driver_license_expired',
    deliveryKey,
    data: {
      kind: 'DRIVER_LICENSE_EXPIRED',
      type: 'driver_license_expired',
      ...(ymd ? { expiration_date: ymd } : {}),
    },
  });
}

async function handleLicenseRenewalAfterStepSave({ userId, profile }) {
  const user = await db.User.findByPk(userId);
  if (!user || user.role !== 'driver') return;

  const refreshed = await syncDriverLicenseExpirationFromStepData(profile);
  const expiration = parseIsoDate(refreshed.drivers_license_expiration_date);
  if (!expiration || isLicenseExpired(expiration)) return;

  await clearLicenseHoldForUser(user, refreshed);
}

async function assertDriverLicenseEligible({ userId, driverProfile = null }) {
  const { HttpError } = require('../utils/httpError');
  const uid = Number(userId);
  if (!uid) throw new HttpError(401, 'Unauthorized');

  const user = await db.User.findByPk(uid, {
    attributes: ['id', 'role', 'status', 'suspended_reason'],
  });
  if (!user || user.role !== 'driver') {
    throw new HttpError(403, 'Forbidden');
  }

  const profile =
    driverProfile ||
    (await db.DriverProfile.findOne({
      where: { user_id: uid },
    }));
  if (!profile) {
    throw new HttpError(403, 'Service provider profile required');
  }

  const synced = await syncDriverLicenseExpirationFromStepData(profile);
  const expiration = resolveDriverLicenseExpirationDate(synced);
  const expired = expiration ? isLicenseExpired(expiration) : false;

  if (profile.license_hold_active || isDriverLicenseSuspendedUser(user) || expired) {
    if (expired && user.status === 'active') {
      await applyLicenseHoldForUser(user, synced);
      await notifyLicenseExpired(user, expiration);
    }
    throw new HttpError(
      403,
      'Your driver license has expired. Upload an updated license to continue accepting service requests.',
      { error_type: 'license_expired' }
    );
  }
}

async function runDriverLicenseComplianceCheck() {
  const profiles = await db.DriverProfile.findAll({
    where: {
      is_completed: true,
    },
    include: [
      {
        model: db.User,
        as: 'user',
        required: true,
        where: { role: 'driver' },
      },
    ],
  });

  let warned = 0;
  let suspended = 0;

  for (const profile of profiles) {
    const user = profile.user;
    if (!user) continue;

    const synced = await syncDriverLicenseExpirationFromStepData(profile);
    const expiration = resolveDriverLicenseExpirationDate(synced);
    if (!expiration) continue;

    const daysRemaining = daysUntilExpiration(expiration);
    if (daysRemaining === null) continue;

    if (daysRemaining < 0) {
      if (!synced.license_hold_active && user.status === 'active') {
        await applyLicenseHoldForUser(user, synced);
        await notifyLicenseExpired(user, expiration);
        suspended += 1;
      } else if (
        synced.license_hold_active &&
        !isDriverLicenseSuspendedUser(user) &&
        user.status === 'active'
      ) {
        await applyLicenseHoldForUser(user, synced);
      }
      continue;
    }

    const sentMilestones = new Set(
      normalizeWarningsSent(synced.license_expiry_warnings_sent),
    );
    const milestone = LICENSE_EXPIRY_WARNING_MILESTONES.find(
      (days) => daysRemaining === days && !sentMilestones.has(String(days))
    );
    if (milestone === undefined) continue;

    await notifyLicenseExpiringSoon(user, expiration, milestone);
    const nextSent = [...sentMilestones, String(milestone)];
    await synced.update({
      license_expiry_warnings_sent: nextSent,
      license_expiry_warning_sent_at: new Date(),
    });
    warned += 1;
  }

  return { checked: profiles.length, warned, suspended };
}

function startDriverLicenseComplianceScheduler() {
  const enabled = String(process.env.DRIVER_LICENSE_COMPLIANCE_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return null;

  const intervalHours = Number(process.env.DRIVER_LICENSE_COMPLIANCE_INTERVAL_HOURS || 24);
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  const run = async () => {
    try {
      const result = await runDriverLicenseComplianceCheck();
      logger.info('driver_license_compliance_check_complete', result);
    } catch (err) {
      logger.error('driver_license_compliance_check_failed', {
        message: err?.message || String(err),
      });
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  logger.info('driver_license_compliance_scheduler_started', {
    intervalHours,
  });

  return timer;
}

module.exports = {
  syncDriverLicenseExpirationFromStepData,
  clearLicenseHoldForUser,
  applyLicenseHoldForUser,
  handleLicenseRenewalAfterStepSave,
  assertDriverLicenseEligible,
  buildDriverLicenseComplianceStatus,
  ensureDriverLicenseComplianceForUser,
  resolveDriverLicenseExpirationYmd,
  runDriverLicenseComplianceCheck,
  startDriverLicenseComplianceScheduler,
};
