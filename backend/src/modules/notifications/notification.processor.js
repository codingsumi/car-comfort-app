const db = require('../../models');
const { logger } = require('../../config/logger');
const { addSendNotificationJob } = require('../queues/notification.queue');
const {
  JOB_SCHEDULE_REMINDER,
  JOB_SEND_NOTIFICATION,
  JOB_NEW_BOOKING_ALERT,
  JOB_CAMPAIGN_SEND,
  JOB_CAMPAIGN_BATCH,
  JOB_BOOKING_TIMER,
} = require('../queues/jobNames');
const { processBookingTimerJob } = require('../../services/bookingTimer.service');
const adminNotificationManagement = require('../../services/admin/adminNotificationManagement.service');
const { sendPushToUser } = require('./push.provider');
const { ensureInboxNotification } = require('./inboxNotification.service');
const {
  getCustomerScheduledOneHourReminderMessage,
  isScheduledBookingForReminders,
} = require('../../constants/bookingAfterBookingMessages');

function previewForStub(notificationType, meta) {
  if (meta?.pushTitle && meta?.pushBody) {
    return {
      title: String(meta.pushTitle),
      body: String(meta.pushBody),
      data: { kind: notificationType, ...(meta.data && typeof meta.data === 'object' ? meta.data : {}) }
    };
  }

  switch (notificationType) {
    case 'SERVICE_DAY':
      return {
        title: 'Service today',
        body: 'Your Car Comfort service is scheduled for today.',
        data: { kind: notificationType }
      };
    case 'REMINDER':
      return {
        title: 'Upcoming appointment',
        body: `Reminder: service in ${meta?.reminderPhase || 'soon'}`,
        data: { kind: notificationType, reminderPhase: meta?.reminderPhase }
      };
    case 'ENROUTE_UPDATE':
      return {
        title: 'Technician en route',
        body: meta?.distanceM != null ? `About ${meta.bucket} (${Math.round(Number(meta.distanceM))} m away)` : 'Updated proximity',
        data: { kind: notificationType, bucket: meta?.bucket }
      };
    case 'ARRIVED':
      return {
        title: 'Arrived',
        body: 'Your technician has arrived at the location.',
        data: { kind: notificationType }
      };
    case 'NEW_BOOKING_ALERT':
      return {
        title: 'New job nearby',
        body: meta?.bookingSummary?.basic_info?.service_address
          ? `New booking: ${meta.bookingSummary.basic_info.service_address}`
          : 'A new booking is available near you.',
        data: { kind: notificationType, booking_id: meta?.bookingSummary?.booking_id }
      };
    case 'BOOKING_TIMER':
      return {
        title: meta?.pushTitle || 'Booking timer',
        body: meta?.pushBody || 'Timer update for your booking.',
        data: {
          kind: notificationType,
          timer_phase: meta?.data?.timer_phase || meta?.reminderPhase || null
        }
      };
    case 'SCHEDULED_SERVICE_REMINDER':
      return {
        title: meta?.pushTitle || 'Upcoming scheduled service',
        body: meta?.pushBody || 'Reminder: your scheduled service is coming up soon.',
        data: { kind: notificationType, reminderPhase: meta?.reminderPhase }
      };
    default:
      return { title: 'Car Comfort', body: 'Notification', data: { kind: notificationType } };
  }
}

async function persistAttempt({ existingId, bookingId, userId, notificationType, uniqueKey, meta, outcome, errorMessage }) {
  const now = new Date();
  const base = {
    user_id: Number(userId),
    booking_id: Number(bookingId),
    notification_type: String(notificationType),
    unique_key: String(uniqueKey),
    meta: outcome === 'success' ? meta || {} : { ...(meta || {}), ...(errorMessage ? { error: errorMessage } : {}) },
    notification_status: outcome === 'success' ? 'success' : 'failed',
    sent_at: now
  };

  if (existingId) {
    await db.NotificationLog.update(
      {
        notification_status: base.notification_status,
        sent_at: base.sent_at,
        meta: base.meta,
        notification_type: base.notification_type
      },
      { where: { id: existingId } }
    );
    return;
  }

  try {
    await db.NotificationLog.create(base);
  } catch (err) {
    if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    const dup = await db.NotificationLog.findOne({ where: { unique_key: String(uniqueKey) } });
    if (dup?.notification_status === 'success') return;
    if (dup) {
      await dup.update({
        notification_status: base.notification_status,
        sent_at: base.sent_at,
        meta: base.meta,
        notification_type: base.notification_type
      });
    }
  }
}

async function processSendNotification(payload) {
  const { uniqueKey, notificationType, bookingId, userId, meta } = payload;
  if (!uniqueKey || !notificationType || !bookingId || !userId) {
    throw new Error('SEND_NOTIFICATION missing required fields');
  }

  const uniq = String(uniqueKey);
  const prior = await db.NotificationLog.findOne({ where: { unique_key: uniq } });
  if (prior?.notification_status === 'success') {
    return { skipped: true, reason: 'already_success' };
  }

  const stub = previewForStub(notificationType, meta);
  const pushData = { ...(stub.data || {}), uniqueKey: uniq, bookingId: Number(bookingId) };

  await ensureInboxNotification({
    userId: Number(userId),
    bookingId: Number(bookingId),
    notificationType,
    deliveryKey: uniq,
    title: stub.title,
    message: stub.body,
    data: pushData
  });

  try {
    await sendPushToUser(Number(userId), {
      title: stub.title,
      body: stub.body,
      data: pushData,
      idempotencyKey: uniq
    });
    await persistAttempt({
      existingId: prior?.id,
      bookingId,
      userId,
      notificationType,
      uniqueKey: uniq,
      meta,
      outcome: 'success'
    });

    const after = await db.NotificationLog.findOne({ where: { unique_key: uniq } });
    if (after?.notification_status !== 'success') {
      logger.warn('Notification log inconsistent after send', { uniqueKey: uniq });
    }

    if (notificationType === 'ENROUTE_UPDATE') {
      await db.NotificationState.update(
        {
          last_notified_at: new Date(),
          last_distance_bucket: meta?.bucket ? String(meta.bucket) : null
        },
        { where: { booking_id: Number(bookingId), enroute_active: true } }
      );
    }

    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await persistAttempt({
      existingId: prior?.id,
      bookingId,
      userId,
      notificationType,
      uniqueKey: uniq,
      meta,
      outcome: 'failed',
      errorMessage: msg
    });
    logger.error('processSendNotification outbound failed — will retry', { uniqueKey: uniq, message: msg });
    throw err;
  }
}

function formatReminderPhaseLabel(mins) {
  if (!Number.isFinite(mins) || mins <= 0) return 'soon';
  if (mins % 60 === 0) {
    const h = mins / 60;
    return h === 1 ? '1 hour' : `${h} hours`;
  }
  return `${mins} minutes`;
}

async function resolveScheduleReminder(payload) {
  const { bookingId, reminderPhase } = payload;
  if (!bookingId || !reminderPhase) throw new Error('SCHEDULE_REMINDER missing bookingId/reminderPhase');

  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking || booking.status === 'cancelled') {
    logger.info('scheduled_reminder_skipped', {
      bookingId,
      reminderPhase,
      reason: 'booking_missing_or_cancelled',
    });
    return { skipped: true, reason: 'booking_missing_or_cancelled' };
  }

  if (!['confirmed', 'assigned', 'in_progress'].includes(String(booking.status))) {
    logger.info('scheduled_reminder_skipped', {
      bookingId,
      reminderPhase,
      reason: 'booking_not_active',
      status: booking.status,
    });
    return { skipped: true, reason: 'booking_not_active' };
  }

  const plain = booking.get({ plain: true });
  const phase = String(reminderPhase);
  const phaseMatch = /^(\d+)min$/.exec(phase);
  const minutesBefore = phaseMatch ? Number(phaseMatch[1]) : null;

  if (!minutesBefore || !isScheduledBookingForReminders(plain)) {
    logger.info('scheduled_reminder_skipped', {
      bookingId,
      reminderPhase,
      reason: 'reminder_phase_not_in_booking_notification_spec',
      schedule_type: plain.schedule_type ?? null,
      minutesBefore,
    });
    return { skipped: true, reason: 'reminder_phase_not_in_booking_notification_spec' };
  }

  const customerId = plain.customer_id || plain.user_id;
  const providerId = plain.provider_id || plain.assigned_driver_user_id;

  if (!customerId || !providerId) {
    logger.info('scheduled_reminder_skipped', {
      bookingId,
      reminderPhase,
      reason: 'missing_customer_or_provider',
      hasCustomer: Boolean(customerId),
      hasProvider: Boolean(providerId),
    });
    return { skipped: true, reason: 'missing_customer_or_provider' };
  }

  const phaseLabel = formatReminderPhaseLabel(minutesBefore);
  const customerReminder =
    minutesBefore === 60
      ? getCustomerScheduledOneHourReminderMessage()
      : {
          title: 'Upcoming scheduled service',
          body: `Reminder: your scheduled service starts in ${phaseLabel}.`,
        };

  return {
    bookingId: Number(bookingId),
    reminderPhase: phase,
    minutesBefore,
    customerId: Number(customerId),
    providerId: Number(providerId),
    customerPayload: {
      notificationType: 'SCHEDULED_SERVICE_REMINDER',
      bookingId: Number(bookingId),
      userId: Number(customerId),
      uniqueKey: `${bookingId}:SCHEDULED_SERVICE_REMINDER:${phase}:user:${customerId}`,
      meta: {
        reminderPhase: phase,
        pushTitle: customerReminder.title,
        pushBody: customerReminder.body,
      },
    },
    driverPayload: {
      notificationType: 'SCHEDULED_SERVICE_REMINDER',
      bookingId: Number(bookingId),
      userId: Number(providerId),
      uniqueKey: `${bookingId}:SCHEDULED_SERVICE_REMINDER:${phase}:user:${providerId}`,
      meta: {
        reminderPhase: phase,
        pushTitle: 'Scheduled service reminder',
        pushBody: `Reminder: service starts in ${phaseLabel}.`,
      },
    },
  };
}

async function processScheduleReminder(payload) {
  const resolved = await resolveScheduleReminder(payload);
  if (resolved.skipped) return resolved;

  await addSendNotificationJob(resolved.customerPayload);
  await addSendNotificationJob(resolved.driverPayload);

  logger.info('scheduled_reminder_processed', {
    bookingId: resolved.bookingId,
    reminderPhase: resolved.reminderPhase,
    minutesBefore: resolved.minutesBefore,
    customerId: resolved.customerId,
    providerId: resolved.providerId,
  });

  return {
    delegated: true,
    customerQueued: true,
    providerQueued: true,
  };
}

/**
 * Send scheduled reminder push immediately (testing / manual recovery).
 * @param {'both'|'customer'|'driver'} audience
 */
async function sendScheduleReminderNow(payload, { audience = 'both', uniqueKeySuffix = '' } = {}) {
  const resolved = await resolveScheduleReminder(payload);
  if (resolved.skipped) return resolved;

  const suffix = uniqueKeySuffix ? String(uniqueKeySuffix) : '';
  const results = {};

  if (audience === 'both' || audience === 'customer') {
    const customerPayload = { ...resolved.customerPayload };
    if (suffix) customerPayload.uniqueKey = `${customerPayload.uniqueKey}${suffix}`;
    results.customer = await processSendNotification(customerPayload);
  }
  if (audience === 'both' || audience === 'driver') {
    const driverPayload = { ...resolved.driverPayload };
    if (suffix) driverPayload.uniqueKey = `${driverPayload.uniqueKey}${suffix}`;
    results.driver = await processSendNotification(driverPayload);
  }

  logger.info('scheduled_reminder_sent_now', {
    bookingId: resolved.bookingId,
    reminderPhase: resolved.reminderPhase,
    audience,
    uniqueKeySuffix: suffix || null,
    results,
  });

  return { sent: true, bookingId: resolved.bookingId, reminderPhase: resolved.reminderPhase, results };
}

/**
 * Push only — no AppNotification / NotificationLog rows (product requirement).
 */
async function processNewBookingAlert(payload) {
  const { driverUserId, bookingId, bookingSummary } = payload || {};
  if (!driverUserId || !bookingId) {
    throw new Error('NEW_BOOKING_ALERT missing driverUserId/bookingId');
  }
  const uniq = `${bookingId}:NEW_BOOKING_ALERT:driver:${driverUserId}`;
  const stub = previewForStub('NEW_BOOKING_ALERT', { bookingSummary });
  const pushData = {
    ...(stub.data || {}),
    kind: 'NEW_BOOKING_ALERT',
    uniqueKey: uniq,
    bookingId: Number(bookingId)
  };

  try {
    await sendPushToUser(Number(driverUserId), {
      title: stub.title,
      body: stub.body,
      data: pushData,
      idempotencyKey: uniq
    });
    return { sent: true };
  } catch (err) {
    const code = err?.code;
    if (code === 'ONESIGNAL_NOT_CONFIGURED') {
      logger.warn('NEW_BOOKING_ALERT skipped — OneSignal not configured', {
        driverUserId,
        bookingId
      });
      return { skipped: true, reason: 'onesignal_not_configured' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('NEW_BOOKING_ALERT push failed — will retry', { uniq, message: msg });
    throw err;
  }
}

async function processCampaignSend(payload) {
  const { campaignId } = payload || {};
  if (!campaignId) throw new Error('CAMPAIGN_SEND missing campaignId');
  return adminNotificationManagement.processScheduledCampaign(Number(campaignId));
}

async function processCampaignBatch(payload) {
  const { campaignId, userIds } = payload || {};
  if (!campaignId || !Array.isArray(userIds)) {
    throw new Error('CAMPAIGN_BATCH missing campaignId/userIds');
  }
  return adminNotificationManagement.processCampaignBatch({
    campaignId: Number(campaignId),
    userIds: userIds.map(Number).filter(Boolean),
  });
}

async function routeNotificationJob(job) {
  if (job.name === JOB_SCHEDULE_REMINDER) {
    return processScheduleReminder(job.data);
  }
  if (job.name === JOB_SEND_NOTIFICATION) {
    return processSendNotification(job.data);
  }
  if (job.name === JOB_NEW_BOOKING_ALERT) {
    return processNewBookingAlert(job.data);
  }
  if (job.name === JOB_CAMPAIGN_SEND) {
    return processCampaignSend(job.data);
  }
  if (job.name === JOB_CAMPAIGN_BATCH) {
    return processCampaignBatch(job.data);
  }
  if (job.name === JOB_BOOKING_TIMER) {
    return processBookingTimerJob(job.data);
  }
  logger.warn('Unknown notification job name', { name: job.name });
  return { skipped: true, reason: 'unknown_job' };
}

module.exports = {
  routeNotificationJob,
  processSendNotification,
  processScheduleReminder,
  sendScheduleReminderNow,
  processNewBookingAlert
};
