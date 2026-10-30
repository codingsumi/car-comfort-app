'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const {
  isOnDemandScheduleType,
  isScheduledBookingForReminders,
} = require('../constants/bookingAfterBookingMessages');
const {
  ON_DEMAND_ACCEPT_WINDOW_MINUTES,
  ARRIVAL_WAIT_WINDOW_MINUTES,
  SCHEDULED_PICKUP_WINDOW_MINUTES,
  SERVICE_TIMER_MAX_MINUTES,
  TIMER_COUNTDOWN_MINUTES,
  SCHEDULED_PICKUP_COUNTDOWN_MINUTES,
  SERVICE_DURATION_COUNTDOWN_MINUTES,
  ON_DEMAND_ACCEPT_WINDOW_MS,
  ARRIVAL_WAIT_WINDOW_MS,
  SCHEDULED_PICKUP_WINDOW_MS,
  SERVICE_TIMER_MAX_MS,
  DRIVER_MOVEMENT_TRACKING_STATUSES,
  BOOKING_TIMER_PHASES,
  hasDriverArrivedAtPickup,
} = require('../constants/bookingTimer.constants');
const { deterministicJobId } = require('../modules/utils/jobKey');
const { getNotificationQueue, addSendNotificationJob } = require('../modules/queues/notification.queue');
const { JOB_BOOKING_TIMER } = require('../modules/queues/jobNames');
const { emitToBookingRoom } = require('../modules/realtime/bookingRoomEmitter');
const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');
const { emitToDriver } = require('../modules/realtime/newBookingSocketEmitter');
const { notifyNearbyDriversBookingCreated } = require('../modules/bookings/bookingCreatedNotify.service');
const { markDriverRejected } = require('../modules/bookings/bookingRejectionCache.service');
const { reverseWalletOnBookingCancel } = require('./providerWallet.service');

function timerJobUniqueKey(bookingId, phase, extra = '') {
  return `${bookingId}:BOOKING_TIMER:${phase}${extra ? `:${extra}` : ''}`;
}

function timerJobId(bookingId, phase, extra = '') {
  return deterministicJobId('btimer', timerJobUniqueKey(bookingId, phase, extra));
}

function hasDriverStartedMoving(trackingStatus) {
  const s = String(trackingStatus || '').trim().toUpperCase();
  return DRIVER_MOVEMENT_TRACKING_STATUSES.has(s);
}

function countdownMinutesForCountdownPhase(phase) {
  switch (phase) {
    case BOOKING_TIMER_PHASES.ACCEPT_COUNTDOWN:
      return TIMER_COUNTDOWN_MINUTES.filter((m) => m <= ON_DEMAND_ACCEPT_WINDOW_MINUTES);
    case BOOKING_TIMER_PHASES.ARRIVAL_COUNTDOWN:
      return TIMER_COUNTDOWN_MINUTES.filter((m) => m <= ARRIVAL_WAIT_WINDOW_MINUTES);
    case BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_COUNTDOWN:
      return SCHEDULED_PICKUP_COUNTDOWN_MINUTES;
    case BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN:
      return SERVICE_DURATION_COUNTDOWN_MINUTES;
    default:
      return [];
  }
}

function buildCountdownSchedule(anchorMs, windowMinutes, countdownPhase, timeoutPhase) {
  const jobs = [];
  const countdownMinutes = countdownMinutesForCountdownPhase(countdownPhase).filter(
    (m) => m <= windowMinutes
  );

  for (const remainingMin of countdownMinutes) {
    const elapsedMin = windowMinutes - remainingMin;
    const runAt = anchorMs + elapsedMin * 60 * 1000;
    jobs.push({
      phase: countdownPhase,
      remainingMin,
      delayMs: runAt - Date.now(),
    });
  }

  const timeoutAt = anchorMs + windowMinutes * 60 * 1000;
  jobs.push({
    phase: timeoutPhase,
    remainingMin: 0,
    delayMs: timeoutAt - Date.now(),
  });

  return jobs;
}

function resolveServiceDateTime(booking) {
  const raw =
    booking.service_datetime ??
    booking.serviceDatetime ??
    booking.scheduled_at ??
    booking.scheduledAt ??
    null;
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

async function addBookingTimerJob({ bookingId, phase, remainingMin, delayMs }) {
  const extra = phase.includes('countdown') ? String(remainingMin) : '';
  const jobId = timerJobId(bookingId, phase, extra);
  const queue = getNotificationQueue();
  try {
    await queue.add(
      JOB_BOOKING_TIMER,
      { bookingId: Number(bookingId), phase, remainingMin },
      {
        jobId,
        delay: Math.max(0, delayMs),
        removeOnComplete: 2000,
        removeOnFail: 5000,
        attempts: 4,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('JobId') || msg.includes('already exists') || msg.includes('duplicate')) {
      return { duplicate: true, jobId };
    }
    throw err;
  }
  return { duplicate: false, jobId };
}

async function cancelBookingTimerJobs(bookingId, phases) {
  const queue = getNotificationQueue();
  const bid = Number(bookingId);
  const phaseList = phases || Object.values(BOOKING_TIMER_PHASES);

  for (const phase of phaseList) {
    if (phase.includes('countdown')) {
      for (const rem of countdownMinutesForCountdownPhase(phase)) {
        const jobId = timerJobId(bid, phase, String(rem));
        try {
          const job = await queue.getJob(jobId);
          if (job) await job.remove();
        } catch (err) {
          logger.debug('cancelBookingTimerJob skip', { jobId, message: err?.message });
        }
      }
    } else {
      const jobId = timerJobId(bid, phase, '');
      try {
        const job = await queue.getJob(jobId);
        if (job) await job.remove();
      } catch (err) {
        logger.debug('cancelBookingTimerJob skip', { jobId, message: err?.message });
      }
    }
  }
}

async function cancelAllBookingTimers(bookingId) {
  await cancelBookingTimerJobs(bookingId, Object.values(BOOKING_TIMER_PHASES));
}

async function emitTimerUpdate(booking, { phase, remainingMin, expiresAt, driverUserId = null }) {
  const bookingId = Number(booking.id);
  const remainingSeconds =
    remainingMin > 0
      ? remainingMin * 60
      : Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

  const payload = {
    booking_id: bookingId,
    timer_phase: phase,
    remaining_minutes: remainingMin,
    remaining_seconds: remainingSeconds,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    schedule_type: booking.schedule_type || null,
    service_started_at: booking.service_started_at
      ? new Date(booking.service_started_at).toISOString()
      : null,
    service_duration_minutes:
      booking.service_duration_minutes != null ? Number(booking.service_duration_minutes) : null,
  };

  emitToBookingRoom(bookingId, 'booking_timer_update', payload);

  const customerId = Number(booking.customer_id || booking.user_id || 0);
  if (customerId > 0) {
    emitToCustomer(customerId, 'booking_timer_update', payload);
  }

  const driverId = Number(
    driverUserId || booking.provider_id || booking.assigned_driver_user_id || 0
  );
  if (driverId > 0) {
    emitToDriver(driverId, 'booking_timer_update', payload);
  }
}

function countdownCopy(phase, remainingMin) {
  if (phase === BOOKING_TIMER_PHASES.ACCEPT_COUNTDOWN) {
    return {
      title: 'Start heading to pickup',
      body: `${remainingMin} minute${remainingMin === 1 ? '' : 's'} left to begin driving to the vehicle pick-up location.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.ARRIVAL_COUNTDOWN) {
    return {
      title: 'Waiting at pick-up',
      body: `${remainingMin} minute${remainingMin === 1 ? '' : 's'} remaining — contact the customer through the app.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.ARRIVAL_EXPIRED) {
    return {
      title: 'Arrival wait ended',
      body: `The ${ARRIVAL_WAIT_WINDOW_MINUTES}-minute wait at pick-up has ended. The provider may mark a customer no-show if needed.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT) {
    return {
      title: 'Pick-up window ended',
      body: `You did not start heading to pick-up within ${ON_DEMAND_ACCEPT_WINDOW_MINUTES} minutes. This on-demand job has been returned to the job board.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_COUNTDOWN) {
    return {
      title: 'Scheduled pick-up window',
      body: `${remainingMin} minute${remainingMin === 1 ? '' : 's'} left to arrive at the vehicle pick-up location.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT) {
    return {
      title: 'Scheduled pick-up missed',
      body: 'You did not arrive at the pick-up location within the scheduled window. This job may be reassigned.',
    };
  }
  if (phase === BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN) {
    return {
      title: 'Service in progress',
      body: `${remainingMin} minute${remainingMin === 1 ? '' : 's'} remaining — your vehicle is still being serviced.`,
    };
  }
  if (phase === BOOKING_TIMER_PHASES.SERVICE_MAX_REACHED) {
    return {
      title: 'Service in progress',
      body: 'Your vehicle has reached the 3-hour service window. We will notify you when it is on the way back.',
    };
  }
  return { title: 'Booking update', body: 'Timer update' };
}

async function notifyTimerParticipants(booking, { phase, remainingMin }) {
  const bookingId = Number(booking.id);
  const customerId = Number(booking.customer_id || booking.user_id || 0);
  const providerId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  const copy = countdownCopy(phase, remainingMin);

  const baseMeta = {
    pushTitle: copy.title,
    pushBody: copy.body,
    data: { kind: 'BOOKING_TIMER', timer_phase: phase, remaining_minutes: String(remainingMin) },
  };

  if (customerId > 0) {
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId,
      userId: customerId,
      uniqueKey: `${bookingId}:BOOKING_TIMER:${phase}:cust:${remainingMin}`,
      meta: { ...baseMeta, reminderPhase: phase },
    });
  }
  if (providerId > 0) {
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId,
      userId: providerId,
      uniqueKey: `${bookingId}:BOOKING_TIMER:${phase}:prov:${remainingMin}`,
      meta: { ...baseMeta, reminderPhase: phase },
    });
  }
}

async function scheduleTimerJobsFromAnchor({
  booking,
  anchorMs,
  windowMinutes,
  countdownPhase,
  timeoutPhase,
  expiresAt,
  initialRemainingMin,
  notifyOnStart = true,
}) {
  const schedule = buildCountdownSchedule(anchorMs, windowMinutes, countdownPhase, timeoutPhase);
  let scheduled = 0;
  for (const job of schedule) {
    if (job.delayMs < 0) continue;
    // Skip the initial tick (remainingMin === initialRemainingMin, delayMs ~= 0).
    // The immediate emitTimerUpdate below already fires this with the correct
    // expires_at anchor, so queuing it again would re-fire seconds later with
    // remaining_seconds = initialRemainingMin * 60, letting clients re-anchor
    // from "now" and inflate the displayed timer (14:55 -> 16:45).
    if (job.remainingMin === initialRemainingMin && job.delayMs < 5000) continue;
    await addBookingTimerJob({
      bookingId: booking.id,
      phase: job.phase,
      remainingMin: job.remainingMin,
      delayMs: job.delayMs,
    });
    scheduled += 1;
  }

  await booking.reload();
  await emitTimerUpdate(booking, {
    phase: countdownPhase,
    remainingMin: initialRemainingMin,
    expiresAt,
  });
  if (notifyOnStart) {
    await notifyTimerParticipants(booking, {
      phase: countdownPhase,
      remainingMin: initialRemainingMin,
    });
  }

  return { scheduled, expiresAt };
}

/**
 * Schedule on-demand accept window timers after driver accepts.
 */
async function scheduleOnDemandAcceptTimers(bookingId, acceptedAt = new Date()) {
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking || !isOnDemandScheduleType(booking.schedule_type)) return { skipped: true };

  const anchorMs = new Date(acceptedAt).getTime();
  const deadline = new Date(anchorMs + ON_DEMAND_ACCEPT_WINDOW_MS);

  await booking.update({
    driver_accepted_at: new Date(acceptedAt),
    on_demand_accept_deadline_at: deadline,
  });

  const result = await scheduleTimerJobsFromAnchor({
    booking,
    anchorMs,
    windowMinutes: ON_DEMAND_ACCEPT_WINDOW_MINUTES,
    countdownPhase: BOOKING_TIMER_PHASES.ACCEPT_COUNTDOWN,
    timeoutPhase: BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT,
    expiresAt: deadline,
    initialRemainingMin: ON_DEMAND_ACCEPT_WINDOW_MINUTES,
  });

  logger.info('on_demand_accept_timers_scheduled', {
    bookingId: booking.id,
    deadline: deadline.toISOString(),
    jobs: result.scheduled,
  });

  return { scheduled: result.scheduled, deadline };
}

async function cancelOnDemandAcceptTimers(bookingId) {
  await cancelBookingTimerJobs(bookingId, [
    BOOKING_TIMER_PHASES.ACCEPT_COUNTDOWN,
    BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT,
  ]);
}

/**
 * Scheduled: 60-minute countdown ending at service start — provider must arrive at pickup.
 */
async function scheduleScheduledPickupTimers(bookingId) {
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking || !isScheduledBookingForReminders(booking.get({ plain: true }))) {
    return { skipped: true };
  }

  const serviceAt = resolveServiceDateTime(booking.get({ plain: true }));
  if (!serviceAt) return { skipped: true, reason: 'no_service_datetime' };

  const deadline = serviceAt;
  const windowStart = new Date(serviceAt.getTime() - SCHEDULED_PICKUP_WINDOW_MS);
  const anchorMs = windowStart.getTime();
  const now = Date.now();
  const remainingMin = Math.max(0, Math.ceil((deadline.getTime() - now) / 60000));

  if (remainingMin <= 0) {
    return { skipped: true, reason: 'service_time_passed' };
  }

  await booking.update({
    scheduled_pickup_window_start_at: windowStart,
    scheduled_pickup_deadline_at: deadline,
  });

  const result = await scheduleTimerJobsFromAnchor({
    booking,
    anchorMs,
    windowMinutes: SCHEDULED_PICKUP_WINDOW_MINUTES,
    countdownPhase: BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_COUNTDOWN,
    timeoutPhase: BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT,
    expiresAt: deadline,
    initialRemainingMin: Math.min(SCHEDULED_PICKUP_WINDOW_MINUTES, remainingMin),
    notifyOnStart: now >= anchorMs,
  });

  logger.info('scheduled_pickup_timers_scheduled', {
    bookingId: booking.id,
    windowStart: windowStart.toISOString(),
    deadline: deadline.toISOString(),
    jobs: result.scheduled,
  });

  return { scheduled: result.scheduled, deadline, windowStart };
}

async function cancelScheduledPickupTimers(bookingId) {
  await cancelBookingTimerJobs(bookingId, [
    BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_COUNTDOWN,
    BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT,
  ]);
}

/**
 * Schedule arrival-wait timers when driver reaches customer for pickup.
 */
async function scheduleArrivalWaitTimers(bookingId, arrivedAt = new Date()) {
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking) return { skipped: true };

  const anchorMs = new Date(arrivedAt).getTime();
  const expiresAt = new Date(anchorMs + ARRIVAL_WAIT_WINDOW_MS);

  await booking.update({
    driver_arrived_customer_at: new Date(arrivedAt),
    arrival_wait_expires_at: expiresAt,
  });

  const result = await scheduleTimerJobsFromAnchor({
    booking,
    anchorMs,
    windowMinutes: ARRIVAL_WAIT_WINDOW_MINUTES,
    countdownPhase: BOOKING_TIMER_PHASES.ARRIVAL_COUNTDOWN,
    timeoutPhase: BOOKING_TIMER_PHASES.ARRIVAL_EXPIRED,
    expiresAt,
    initialRemainingMin: ARRIVAL_WAIT_WINDOW_MINUTES,
    notifyOnStart: false,
  });

  logger.info('arrival_wait_timers_scheduled', {
    bookingId: booking.id,
    windowMinutes: ARRIVAL_WAIT_WINDOW_MINUTES,
    expiresAt: expiresAt.toISOString(),
    jobs: result.scheduled,
  });

  return { scheduled: result.scheduled, expiresAt };
}

async function cancelArrivalWaitTimers(bookingId) {
  await cancelBookingTimerJobs(bookingId, [
    BOOKING_TIMER_PHASES.ARRIVAL_COUNTDOWN,
    BOOKING_TIMER_PHASES.ARRIVAL_EXPIRED,
  ]);
}

/**
 * 0–3 hour service timer after OTP verified or service started.
 */
async function scheduleServiceDurationTimer(bookingId, startedAt = new Date()) {
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking) return { skipped: true };
  if (booking.service_started_at) return { skipped: true, reason: 'already_started' };

  const anchorMs = new Date(startedAt).getTime();
  const expiresAt = new Date(anchorMs + SERVICE_TIMER_MAX_MS);

  await booking.update({
    service_started_at: new Date(startedAt),
    service_timer_expires_at: expiresAt,
  });

  const result = await scheduleTimerJobsFromAnchor({
    booking,
    anchorMs,
    windowMinutes: SERVICE_TIMER_MAX_MINUTES,
    countdownPhase: BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN,
    timeoutPhase: BOOKING_TIMER_PHASES.SERVICE_MAX_REACHED,
    expiresAt,
    initialRemainingMin: SERVICE_TIMER_MAX_MINUTES,
    // Suppress the generic '180 minutes remaining' push; we send the
    // OTP-verified / before-service-photos notification below instead.
    notifyOnStart: false,
  });

  // Send the contextually accurate notification for the moment right after
  // OTP verification: provider has begun capturing before-service photos.
  const _otpPhotoCustomerId = Number(booking.customer_id || booking.user_id || 0);
  const _otpPhotoProviderId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  await emitTimerUpdate(booking, {
    phase: BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN,
    remainingMin: SERVICE_TIMER_MAX_MINUTES,
    expiresAt,
  });
  const _otpPhotoMeta = {
    pushTitle: 'OTP Pin Verified',
    pushBody: 'Before Service Photos Are In Progress.',
    data: { kind: 'BOOKING_TIMER', timer_phase: BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN },
  };
  if (_otpPhotoCustomerId > 0) {
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId,
      userId: _otpPhotoCustomerId,
      uniqueKey: `${bookingId}:BOOKING_TIMER:otp_verified_photos_start:cust`,
      meta: { ..._otpPhotoMeta, reminderPhase: BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN },
    }).catch(() => {});
  }
  if (_otpPhotoProviderId > 0) {
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId,
      userId: _otpPhotoProviderId,
      uniqueKey: `${bookingId}:BOOKING_TIMER:otp_verified_photos_start:prov`,
      meta: { ..._otpPhotoMeta, reminderPhase: BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN },
    }).catch(() => {});
  }

  logger.info('service_duration_timer_scheduled', {
    bookingId: booking.id,
    startedAt: new Date(startedAt).toISOString(),
    expiresAt: expiresAt.toISOString(),
    jobs: result.scheduled,
  });

  return { scheduled: result.scheduled, expiresAt };
}

async function cancelServiceDurationTimers(bookingId) {
  await cancelBookingTimerJobs(bookingId, [
    BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN,
    BOOKING_TIMER_PHASES.SERVICE_MAX_REACHED,
  ]);
}

async function finalizeServiceDurationTimer(bookingId, completedAt = new Date()) {
  await cancelServiceDurationTimers(bookingId);
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking?.service_started_at) return { skipped: true };

  const startedMs = new Date(booking.service_started_at).getTime();
  const completedMs = new Date(completedAt).getTime();
  const durationMin = Math.max(0, Math.round((completedMs - startedMs) / 60000));

  await booking.update({
    service_completed_at: new Date(completedAt),
    // Do NOT overwrite service_duration_minutes (the admin-configured package
    // duration) — that field is set once at booking confirm time and must
    // remain stable across the entire lifecycle so driver/customer UIs always
    // display the correct estimated duration.  Write the measured time to a
    // separate column for analytics / invoice / billing use.
    actual_service_duration_minutes: durationMin,
    service_timer_expires_at: null,
  });

  await booking.reload();
  await emitTimerUpdate(booking, {
    phase: 'service_completed',
    remainingMin: 0,
    expiresAt: null,
  });

  logger.info('service_duration_timer_finalized', {
    bookingId: booking.id,
    service_duration_minutes: durationMin,
  });

  return { service_duration_minutes: durationMin };
}

async function notifyBookingReturnedToBoard(
  booking,
  { reason, driverMessage, customerMessage, previousDriverId, socketKind = 'TIMER_TIMEOUT', timerPhase = null }
) {
  const driverId = Number(previousDriverId || booking.assigned_driver_user_id || booking.provider_id || 0);

  if (driverId > 0) {
    await markDriverRejected({ bookingId: booking.id, driverUserId: driverId }).catch(() => {});
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId: booking.id,
      userId: driverId,
      uniqueKey: `${booking.id}:${socketKind}:driver:${driverId}:${reason}`,
      meta: {
        pushTitle: 'Job returned to board',
        pushBody: driverMessage,
        data: { kind: socketKind, reason },
      },
    });
    emitToDriver(driverId, 'booking_status_update', {
      booking_id: booking.id,
      booking_status: socketKind,
      reason,
      ...(timerPhase ? { timer_phase: timerPhase } : {}),
      message: driverMessage,
      updated_at: new Date().toISOString(),
    });
  }

  const customerId = Number(booking.customer_id || booking.user_id || 0);
  if (customerId > 0) {
    await addSendNotificationJob({
      notificationType: 'BOOKING_TIMER',
      bookingId: booking.id,
      userId: customerId,
      uniqueKey: `${booking.id}:${socketKind}:customer:${reason}`,
      meta: {
        pushTitle: 'Finding another provider',
        pushBody: customerMessage,
        data: { kind: socketKind, reason },
      },
    });
    emitToCustomer(customerId, 'booking_status_update', {
      booking_id: booking.id,
      booking_status: 'confirmed',
      message: 'Searching for another service provider.',
      updated_at: new Date().toISOString(),
    });
  }

  await notifyNearbyDriversBookingCreated(booking.id).catch((err) => {
    logger.error('booking_reopen_board_notify_failed', { bookingId: booking.id, message: err?.message });
  });
}

async function unassignDriverAndReopenBoard(
  booking,
  {
    reason,
    driverMessage,
    customerMessage,
    extraBookingFields = {},
    skipWalletReverse = false,
    socketKind = 'TIMER_TIMEOUT',
    timerPhase = null,
  }
) {
  const previousDriverId = Number(booking.assigned_driver_user_id || booking.provider_id || 0);
  const t = await db.sequelize.transaction();
  try {
    if (previousDriverId > 0 && !skipWalletReverse) {
      await reverseWalletOnBookingCancel({ booking, transaction: t }).catch((err) => {
        logger.warn('timer_timeout_wallet_reverse_failed', {
          bookingId: booking.id,
          message: err?.message,
        });
      });
    }
    await booking.update(
      {
        assigned_driver_user_id: null,
        provider_id: null,
        status: 'confirmed',
        tracking_status: null,
        driver_accepted_at: null,
        on_demand_accept_deadline_at: null,
        scheduled_pickup_window_start_at: null,
        scheduled_pickup_deadline_at: null,
        ...extraBookingFields,
      },
      { transaction: t }
    );
    await t.commit();
    await booking.reload();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  await notifyBookingReturnedToBoard(booking, {
    reason,
    driverMessage,
    customerMessage,
    previousDriverId,
    socketKind,
    timerPhase,
  });

  return { reassigned: true, previousDriverId, reason };
}

async function handleOnDemandAcceptTimeout(booking) {
  if (!isOnDemandScheduleType(booking.schedule_type)) return { skipped: true, reason: 'not_on_demand' };
  if (!['assigned', 'in_progress'].includes(String(booking.status))) {
    return { skipped: true, reason: 'status_changed' };
  }
  if (hasDriverStartedMoving(booking.tracking_status)) {
    return { skipped: true, reason: 'driver_already_moving' };
  }

  const previousDriverId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  const expiredAt = booking.on_demand_accept_deadline_at || new Date();
  const driverMessage =
    'You did not start heading to pick-up within 15 minutes. This job has been returned to the job board.';

  const result = await unassignDriverAndReopenBoard(booking, {
    reason: 'accept_timeout',
    driverMessage,
    customerMessage:
      'Your assigned provider did not start heading to pick-up in time. We are looking for another provider.',
    socketKind: 'TIMER_TIMEOUT',
    timerPhase: BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT,
  });

  await booking.reload();
  await emitTimerUpdate(booking, {
    phase: BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT,
    remainingMin: 0,
    expiresAt: expiredAt,
    driverUserId: result.previousDriverId || previousDriverId,
  });

  logger.info('on_demand_accept_timeout_applied', {
    bookingId: booking.id,
    previousDriverId: result.previousDriverId,
  });
  return result;
}

async function handleScheduledPickupTimeout(booking) {
  if (!isScheduledBookingForReminders(booking.get({ plain: true }))) {
    return { skipped: true, reason: 'not_scheduled' };
  }
  if (!['assigned', 'in_progress'].includes(String(booking.status))) {
    return { skipped: true, reason: 'status_changed' };
  }
  if (hasDriverArrivedAtPickup(booking.tracking_status)) {
    return { skipped: true, reason: 'already_arrived' };
  }

  const previousDriverId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  const expiredAt = booking.scheduled_pickup_deadline_at || new Date();
  const driverMessage =
    'You did not arrive at the vehicle pick-up location within the scheduled 60-minute window. This job has been returned to the job board.';

  const result = await unassignDriverAndReopenBoard(booking, {
    reason: 'scheduled_pickup_timeout',
    driverMessage,
    customerMessage:
      'Your assigned provider did not arrive at pick-up in time. We are looking for another provider.',
  });

  await booking.reload();
  await emitTimerUpdate(booking, {
    phase: BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT,
    remainingMin: 0,
    expiresAt: expiredAt,
    driverUserId: result.previousDriverId || previousDriverId,
  });

  const notifyDriverId = Number(result.previousDriverId || previousDriverId || 0);
  if (notifyDriverId > 0) {
    emitToDriver(notifyDriverId, 'booking_status_update', {
      booking_id: booking.id,
      booking_status: 'TIMER_TIMEOUT',
      timer_phase: BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT,
      message: driverMessage,
      updated_at: new Date().toISOString(),
    });
  }

  logger.info('scheduled_pickup_timeout_applied', {
    bookingId: booking.id,
    previousDriverId: result.previousDriverId,
  });
  return result;
}

async function processBookingTimerJob({ bookingId, phase, remainingMin }) {
  const booking = await db.Booking.findByPk(Number(bookingId));
  if (!booking || booking.status === 'cancelled' || booking.status === 'completed') {
    return { skipped: true, reason: 'booking_inactive' };
  }

  const phaseKey = String(phase || '');

  if (phaseKey === BOOKING_TIMER_PHASES.ACCEPT_TIMEOUT) {
    return handleOnDemandAcceptTimeout(booking);
  }

  if (phaseKey === BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_TIMEOUT) {
    return handleScheduledPickupTimeout(booking);
  }

  if (phaseKey === BOOKING_TIMER_PHASES.ACCEPT_COUNTDOWN) {
    if (!isOnDemandScheduleType(booking.schedule_type)) return { skipped: true };
    if (hasDriverStartedMoving(booking.tracking_status)) return { skipped: true };
    const expiresAt = booking.on_demand_accept_deadline_at;
    await emitTimerUpdate(booking, { phase: phaseKey, remainingMin, expiresAt });
    await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin });
    return { tick: true };
  }

  if (phaseKey === BOOKING_TIMER_PHASES.SCHEDULED_PICKUP_COUNTDOWN) {
    if (hasDriverArrivedAtPickup(booking.tracking_status)) return { skipped: true };
    const expiresAt = booking.scheduled_pickup_deadline_at;
    await emitTimerUpdate(booking, { phase: phaseKey, remainingMin, expiresAt });
    if (remainingMin <= 15) {
      await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin });
    }
    return { tick: true };
  }

  if (phaseKey === BOOKING_TIMER_PHASES.ARRIVAL_COUNTDOWN) {
    const expiresAt = booking.arrival_wait_expires_at;
    await emitTimerUpdate(booking, { phase: phaseKey, remainingMin, expiresAt });
    if (remainingMin <= 5) {
      await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin });
    }
    return { tick: true };
  }

  if (phaseKey === BOOKING_TIMER_PHASES.ARRIVAL_EXPIRED) {
    await emitTimerUpdate(booking, {
      phase: phaseKey,
      remainingMin: 0,
      expiresAt: booking.arrival_wait_expires_at,
    });
    await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin: 0 });
    return { expired: true };
  }

  if (phaseKey === BOOKING_TIMER_PHASES.SERVICE_COUNTDOWN) {
    if (booking.service_completed_at) return { skipped: true, reason: 'service_completed' };
    const expiresAt = booking.service_timer_expires_at;
    await emitTimerUpdate(booking, { phase: phaseKey, remainingMin, expiresAt });
    if (remainingMin <= 30) {
      await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin });
    }
    return { tick: true };
  }

  if (phaseKey === BOOKING_TIMER_PHASES.SERVICE_MAX_REACHED) {
    if (booking.service_completed_at) return { skipped: true, reason: 'service_completed' };
    await emitTimerUpdate(booking, {
      phase: phaseKey,
      remainingMin: 0,
      expiresAt: booking.service_timer_expires_at,
    });
    await notifyTimerParticipants(booking, { phase: phaseKey, remainingMin: 0 });
    return { max_reached: true };
  }

  return { skipped: true, reason: 'unknown_phase' };
}

module.exports = {
  scheduleOnDemandAcceptTimers,
  cancelOnDemandAcceptTimers,
  scheduleScheduledPickupTimers,
  cancelScheduledPickupTimers,
  scheduleArrivalWaitTimers,
  cancelArrivalWaitTimers,
  scheduleServiceDurationTimer,
  cancelServiceDurationTimers,
  finalizeServiceDurationTimer,
  processBookingTimerJob,
  handleOnDemandAcceptTimeout,
  hasDriverStartedMoving,
  hasDriverArrivedAtPickup,
  cancelBookingTimerJobs,
  cancelAllBookingTimers,
  unassignDriverAndReopenBoard,
  notifyBookingReturnedToBoard,
};
