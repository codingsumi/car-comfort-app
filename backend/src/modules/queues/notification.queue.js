const { Queue } = require('bullmq');
const { createRedisConnection } = require('../configs/redis.connection');
const { loadNotificationConfig } = require('../configs/notification.config');
const {
  JOB_SEND_NOTIFICATION,
  JOB_SCHEDULE_REMINDER,
  JOB_NEW_BOOKING_ALERT,
  JOB_CAMPAIGN_SEND,
  JOB_CAMPAIGN_BATCH,
  JOB_BOOKING_TIMER,
} = require('./jobNames');
const { deterministicJobId } = require('../utils/jobKey');
const { logger } = require('../../config/logger');
const { SCHEDULED_REMINDER_OFFSETS_MIN } = require('../../constants/bookingNotification.constants');

let _queue;

const defaultOpts = () => ({
  removeOnComplete: 2000,
  removeOnFail: 5000,
  attempts: 6,
  backoff: {
    type: 'exponential',
    delay: 3000
  }
});

function getNotificationQueue() {
  if (!_queue) {
    const cfg = loadNotificationConfig();
    _queue = new Queue(cfg.queueName, {
      connection: createRedisConnection(),
      defaultJobOptions: defaultOpts()
    });
  }
  return _queue;
}

async function addSendNotificationJob(payload, { delayMs = 0 } = {}) {
  const uniqueKey = String(payload.uniqueKey);
  const jobId = deterministicJobId('send', uniqueKey);
  const queue = getNotificationQueue();
  try {
    await queue.add(JOB_SEND_NOTIFICATION, payload, {
      jobId,
      delay: Math.max(0, delayMs),
      ...defaultOpts()
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (
      msg.includes('JobId') ||
      msg.includes('already exists') ||
      msg.includes('duplicate')
    ) {
      logger.debug('Skip duplicate notification job', { jobId, uniqueKey });
      return { duplicate: true, jobId };
    }
    throw err;
  }
  return { duplicate: false, jobId };
}

function scheduledReminderJobId(bookingId, offsetMin) {
  return `sched-reminder-${Number(bookingId)}-${Number(offsetMin)}m`;
}

async function removeScheduledReminderJob(bookingId, offsetMin) {
  const queue = getNotificationQueue();
  const jobId = scheduledReminderJobId(bookingId, offsetMin);
  const job = await queue.getJob(jobId);
  if (!job) return false;
  await job.remove();
  return true;
}

/** Remove all pending scheduled-service reminder jobs for a booking (e.g. on cancel). */
async function cancelScheduledReminderJobsForBooking(bookingId, offsetsMin = SCHEDULED_REMINDER_OFFSETS_MIN) {
  const bid = Number(bookingId);
  if (!bid) return { removed: 0 };
  let removed = 0;
  for (const min of offsetsMin) {
    if (await removeScheduledReminderJob(bid, min)) removed += 1;
  }
  if (removed > 0) {
    logger.info('scheduled_service_reminders_cancelled', { bookingId: bid, removed });
  }
  return { removed };
}

async function addScheduleReminderJob(payload, { delayMs = 0, jobId } = {}) {
  const queue = getNotificationQueue();
  const id = jobId || deterministicJobId('sched', `${payload.bookingId}:${payload.reminderPhase}`);
  try {
    await queue.add(JOB_SCHEDULE_REMINDER, payload, {
      jobId: id,
      delay: Math.max(0, delayMs),
      ...defaultOpts()
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('JobId') || msg.includes('already exists') || msg.includes('duplicate')) {
      logger.debug('Skip duplicate scheduler job', { jobId: id });
      return { duplicate: true, jobId: id };
    }
    throw err;
  }
  return { duplicate: false, jobId: id };
}

/**
 * One BullMQ job per driver — idempotent jobId per booking+driver (no DB notification persistence).
 */
async function addNewBookingAlertJobs({ bookingId, driverUserIds, bookingSummary }) {
  const bid = Number(bookingId);
  if (!bid || !Array.isArray(driverUserIds) || !driverUserIds.length) return { queued: 0 };

  const queue = getNotificationQueue();
  let queued = 0;
  await Promise.all(
    driverUserIds.map(async (rawId) => {
      const driverUserId = Number(rawId);
      if (!driverUserId) return;
      const uniqueKey = `${bid}:NEW_BOOKING_ALERT:driver:${driverUserId}`;
      const jobId = deterministicJobId('nba', uniqueKey);
      try {
        await queue.add(
          JOB_NEW_BOOKING_ALERT,
          { driverUserId, bookingId: bid, bookingSummary },
          {
            jobId,
            ...defaultOpts()
          }
        );
        queued += 1;
      } catch (err) {
        const msg = String(err?.message || '');
        if (msg.includes('JobId') || msg.includes('already exists') || msg.includes('duplicate')) {
          logger.debug('Skip duplicate NEW_BOOKING_ALERT job', { jobId, uniqueKey });
          return;
        }
        throw err;
      }
    })
  );
  return { queued };
}

/**
 * Queue 24h / 12h / 5h / 2h / 1h reminders before `scheduled_at` for customer + provider.
 * Call when a provider accepts a scheduled booking (not at payment — provider must be assigned).
 */
async function scheduleBookingNotificationPipeline(booking) {
  const { isScheduledBookingForReminders } = require('../../constants/bookingAfterBookingMessages');
  const cfg = loadNotificationConfig();
  if (!booking?.id) return { skipped: true, reason: 'missing_booking_id' };

  if (!isScheduledBookingForReminders(booking)) {
    return {
      skipped: true,
      reason: 'not_scheduled',
      schedule_type: booking.schedule_type ?? null,
    };
  }

  const providerId = booking.provider_id ?? booking.assigned_driver_user_id;
  if (!providerId) {
    return { skipped: true, reason: 'no_assigned_provider' };
  }

  const serviceAt = booking.service_datetime || booking.scheduled_at;
  if (!serviceAt) return { skipped: true, reason: 'missing_service_time' };

  const svcMs = new Date(serviceAt).getTime();
  if (!Number.isFinite(svcMs) || svcMs <= Date.now()) {
    return { skipped: true, reason: 'service_in_past' };
  }

  const queue = getNotificationQueue();
  let queued = 0;
  let skippedPast = 0;
  let replaced = 0;
  const queuedOffsets = [];
  const skippedOffsets = [];

  for (const min of cfg.reminderOffsetsMin) {
    const runAt = svcMs - min * 60 * 1000;
    const delay = runAt - Date.now();
    if (delay < 0) {
      skippedPast += 1;
      skippedOffsets.push(min);
      continue;
    }
    if (await removeScheduledReminderJob(booking.id, min)) {
      replaced += 1;
    }
    await addScheduleReminderJob(
      { bookingId: booking.id, reminderPhase: `${min}min` },
      { delayMs: delay, jobId: scheduledReminderJobId(booking.id, min) }
    );
    queued += 1;
    queuedOffsets.push(min);
  }

  logger.info('scheduled_service_reminders_queued', {
    bookingId: booking.id,
    serviceAt: new Date(serviceAt).toISOString(),
    offsetsMin: cfg.reminderOffsetsMin,
    queued,
    queuedOffsets,
    skippedOffsets,
    skippedPast,
    replaced,
    schedule_type: booking.schedule_type || 'scheduled',
    queueName: cfg.queueName,
  });

  return { queued, skippedPast, replaced, queuedOffsets, skippedOffsets, offsetsMin: cfg.reminderOffsetsMin };
}

async function addCampaignSendJob(payload, { delayMs = 0 } = {}) {
  const campaignId = Number(payload.campaignId);
  const jobId = deterministicJobId('campaign-send', String(campaignId));
  const queue = getNotificationQueue();
  try {
    await queue.add(JOB_CAMPAIGN_SEND, payload, {
      jobId,
      delay: Math.max(0, delayMs),
      ...defaultOpts(),
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('JobId') || msg.includes('already exists') || msg.includes('duplicate')) {
      return { duplicate: true, jobId };
    }
    throw err;
  }
  return { duplicate: false, jobId };
}

async function removeCampaignSendJob(campaignId) {
  const id = Number(campaignId);
  if (!id) return { removed: false };
  const jobId = deterministicJobId('campaign-send', String(id));
  const queue = getNotificationQueue();
  const job = await queue.getJob(jobId);
  if (!job) return { removed: false, jobId };
  await job.remove();
  return { removed: true, jobId };
}

async function addCampaignBatchJob(payload, { batchKey = '0' } = {}) {
  const campaignId = Number(payload.campaignId);
  const offset = Number(payload.offset || 0);
  const jobId = deterministicJobId('campaign-batch', `${campaignId}:${offset}:${batchKey}`);
  const queue = getNotificationQueue();
  try {
    await queue.add(JOB_CAMPAIGN_BATCH, payload, {
      jobId,
      ...defaultOpts(),
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('JobId') || msg.includes('already exists') || msg.includes('duplicate')) {
      return { duplicate: true, jobId };
    }
    throw err;
  }
  return { duplicate: false, jobId };
}

module.exports = {
  getNotificationQueue,
  addSendNotificationJob,
  addScheduleReminderJob,
  addNewBookingAlertJobs,
  addCampaignSendJob,
  addCampaignBatchJob,
  removeCampaignSendJob,
  cancelScheduledReminderJobsForBooking,
  scheduleBookingNotificationPipeline,
  JOB_SEND_NOTIFICATION,
  JOB_SCHEDULE_REMINDER,
  JOB_NEW_BOOKING_ALERT,
  JOB_CAMPAIGN_SEND,
  JOB_CAMPAIGN_BATCH,
  JOB_BOOKING_TIMER,
};
