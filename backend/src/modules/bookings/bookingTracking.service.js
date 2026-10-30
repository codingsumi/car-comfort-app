'use strict';

const crypto = require('crypto');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { logger } = require('../../config/logger');
const {
  TRACKING_STATUSES_SET,
  TRACKING_STATUS_MESSAGES,
  resolveTrackingStatusRank
} = require('./trackingStatuses');
const { emitToBookingRoom } = require('../realtime/bookingRoomEmitter');
const { emitToCustomer } = require('../realtime/customerSocketEmitter');
const { ensureInboxNotification } = require('../notifications/inboxNotification.service');
const { sendPushToUser } = require('../notifications/push.provider');
const { isOneSignalConfigured } = require('../../config/onesignal');
const {
  handleBookingStatusWalletTransition,
  creditWalletOnServiceStart,
} = require('../../services/providerWallet.service');
const { captureBookingChatOnCompletion } = require('../../services/bookingChat.service');
const {
  cancelOnDemandAcceptTimers,
  scheduleArrivalWaitTimers,
  cancelArrivalWaitTimers,
  cancelScheduledPickupTimers,
  scheduleServiceDurationTimer,
  finalizeServiceDurationTimer,
  hasDriverStartedMoving,
  handleOnDemandAcceptTimeout,
} = require('../../services/bookingTimer.service');
const { isOnDemandScheduleType } = require('../../constants/bookingAfterBookingMessages');
const { customerVehiclePickupOtpFromBooking } = require('../../utils/customerPickupOtp');
const { notifyCustomerPickupOtp } = require('../../services/pickupOtpNotify.service');
const {
  notifyCustomerServiceMilestone,
  shouldSuppressGenericCustomerPush,
} = require('../../services/customerServiceMilestoneNotify.service');

/** Marks booking completed and releases driver wallet when service is fully delivered. */
const BOOKING_COMPLETE_TRACKING_STATUS = 'VEHICLE_DELIVERED';

const INELIGIBLE_STATUSES = new Set(['draft', 'pending_payment', 'cancelled', 'completed']);
const OTP_EXPIRY_MINUTES = 10;

function parseBookingId(idRaw) {
  const id = Number.parseInt(String(idRaw), 10);
  if (!id || id < 1) throw new HttpError(400, 'booking id is invalid');
  return id;
}

async function loadDriverDetails(driverUserId) {
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

function resolveCustomerId(booking) {
  const cid = Number(booking.customer_id || booking.user_id || 0);
  return cid > 0 ? cid : null;
}

function generateOtp() {
  return String(crypto.randomInt(1000, 9999));
}

/**
 * Core tracking status handler.
 * Validates, persists, emits socket event, saves notification, sends push.
 */
async function applyTrackingStatus(bookingIdRaw, rawTrackingStatus, auth, req = null) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Only service providers can update tracking status');

  const bookingId = parseBookingId(bookingIdRaw);
  const trackingStatus = String(rawTrackingStatus || '').trim().toUpperCase();

  if (!TRACKING_STATUSES_SET.has(trackingStatus)) {
    throw new HttpError(400, `Invalid tracking_status: ${rawTrackingStatus}`);
  }

  const booking = await db.Booking.findByPk(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');

  const actor = Number(auth.userId);
  const assigned = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  if (!assigned || assigned !== actor) {
    throw new HttpError(403, 'You are not the assigned service provider for this booking');
  }

  if (INELIGIBLE_STATUSES.has(String(booking.status))) {
    throw new HttpError(409, 'Booking is not eligible for tracking updates');
  }

  const currentTracking = String(booking.tracking_status || '').trim().toUpperCase();
  if (currentTracking === BOOKING_COMPLETE_TRACKING_STATUS) {
    throw new HttpError(409, 'Booking delivery is already complete');
  }
  if (currentTracking === trackingStatus) {
    return {
      booking_id: bookingId,
      tracking_status: trackingStatus,
      log_id: null,
      noop: true
    };
  }

  // Stale in-flight issue reports must not overwrite a location the driver already fixed.
  if (trackingStatus === 'SERVICE_LOCATION_ISSUE') {
    const allowedFrom = new Set([
      'DRIVER_REACHED_SERVICE_CENTER',
      'VEHICLE_WAITING_IN_QUEUE',
      'DRIVER_REACHED_NEXT_SERVICE_STOP',
    ]);
    if (currentTracking && !allowedFrom.has(currentTracking)) {
      logger.info('service_location_issue_skipped', {
        bookingId,
        currentTracking,
      });
      return {
        booking_id: bookingId,
        tracking_status: currentTracking,
        log_id: null,
        noop: true,
      };
    }
  }

  if (currentTracking) {
    const currentRank = resolveTrackingStatusRank(currentTracking);
    const nextRank = resolveTrackingStatusRank(trackingStatus);
    if (currentRank >= 0 && nextRank >= 0 && nextRank < currentRank) {
      throw new HttpError(409, 'Booking tracking status cannot move backward');
    }
  }

  if (
    trackingStatus === 'DRIVER_STARTED_TO_CUSTOMER' &&
    isOnDemandScheduleType(booking.schedule_type) &&
    !hasDriverStartedMoving(currentTracking)
  ) {
    const deadline = booking.on_demand_accept_deadline_at;
    if (deadline && new Date(deadline).getTime() <= Date.now()) {
      await handleOnDemandAcceptTimeout(booking);
      throw new HttpError(
        409,
        'The 15-minute start window has expired. This job was returned to the job board.'
      );
    }
  }

  const message = TRACKING_STATUS_MESSAGES[trackingStatus] || trackingStatus;
  const updatedAt = new Date().toISOString();

  const updateFields = { tracking_status: trackingStatus };
  let otp = null;

  if (trackingStatus === 'DRIVER_REACHED_CUSTOMER') {
    otp = generateOtp();
    updateFields.pickup_otp = otp;
    updateFields.pickup_otp_expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  }

  if (
    trackingStatus === 'DRIVER_STARTED_TO_SERVICE_CENTER' &&
    !booking.driver_started_to_service_center_at
  ) {
    updateFields.driver_started_to_service_center_at = new Date();
  }

  if (trackingStatus === 'DRIVER_HEADING_TO_NEXT_SERVICE_STOP') {
    if (String(booking.service_type || '') === 'combo') {
      updateFields.combo_service_stop_index = 1;
    }
  }

  await booking.update(updateFields);

  if (trackingStatus === 'DRIVER_STARTED_TO_CUSTOMER') {
    try {
      await creditWalletOnServiceStart({
        providerId: actor,
        booking,
        transaction: null,
      });
    } catch (err) {
      logger.error('booking_service_start_advance_failed', {
        bookingId,
        providerId: actor,
        message: err?.message,
      });
    }
  }

  if (hasDriverStartedMoving(trackingStatus) && trackingStatus !== 'DRIVER_REACHED_CUSTOMER') {
    await cancelOnDemandAcceptTimers(bookingId).catch((err) => {
      logger.warn('cancel_on_demand_accept_timers_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === 'DRIVER_REACHED_CUSTOMER') {
    await cancelOnDemandAcceptTimers(bookingId).catch(() => {});
    await cancelScheduledPickupTimers(bookingId).catch(() => {});
    await scheduleArrivalWaitTimers(bookingId, new Date()).catch((err) => {
      logger.error('schedule_arrival_wait_timers_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === 'OTP_VERIFIED') {
    await cancelArrivalWaitTimers(bookingId).catch(() => {});
    await scheduleServiceDurationTimer(bookingId, new Date()).catch((err) => {
      logger.error('schedule_service_duration_timer_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === 'SERVICE_STARTED') {
    await scheduleServiceDurationTimer(bookingId, new Date()).catch((err) => {
      logger.error('schedule_service_duration_timer_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === 'SERVICE_COMPLETED') {
    const isComboFirstStop =
      String(booking.service_type || '') === 'combo' &&
      Number(booking.combo_service_stop_index || 0) === 0;
    if (!isComboFirstStop) {
      await finalizeServiceDurationTimer(bookingId, new Date()).catch((err) => {
        logger.error('finalize_service_duration_timer_failed', { bookingId, message: err?.message });
      });
    }
  }

  if (trackingStatus === 'SECOND_SERVICE_STARTED') {
    await scheduleServiceDurationTimer(bookingId, new Date()).catch((err) => {
      logger.error('schedule_service_duration_timer_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === 'SECOND_SERVICE_COMPLETED') {
    await finalizeServiceDurationTimer(bookingId, new Date()).catch((err) => {
      logger.error('finalize_service_duration_timer_failed', { bookingId, message: err?.message });
    });
  }

  if (trackingStatus === BOOKING_COMPLETE_TRACKING_STATUS && String(booking.status) !== 'completed') {
    await finalizeServiceDurationTimer(bookingId, new Date()).catch(() => {});
    const previousStatus = booking.status;
    await booking.update({ status: 'completed' });
    await booking.reload();
    captureBookingChatOnCompletion(bookingId).catch((err) => {
      logger.error('booking_complete_chat_capture_failed', {
        bookingId,
        message: err?.message,
      });
    });
    try {
      await handleBookingStatusWalletTransition({
        booking,
        previousStatus,
        transaction: null,
      });
    } catch (err) {
      logger.error('booking_complete_wallet_release_failed', {
        bookingId,
        message: err?.message,
      });
    }
  }

  const logEntry = await db.BookingTrackingLog.create({
    booking_id: bookingId,
    tracking_status: trackingStatus,
    message,
    metadata: { driver_user_id: actor }
  });

  logger.info('tracking_status_applied', {
    bookingId,
    trackingStatus,
    driverUserId: actor,
    logId: logEntry.id,
    otpGenerated: !!otp
  });

  const driverDetails = await loadDriverDetails(actor);
  const socketPayload = {
    booking_id: bookingId,
    tracking_status: trackingStatus,
    message,
    driver: driverDetails,
    updated_at: updatedAt
  };

  emitToBookingRoom(bookingId, 'booking_tracking_update', socketPayload);

  const customerId = resolveCustomerId(booking.get({ plain: true }));
  if (!customerId) {
    logger.warn('tracking_notify_skipped_no_customer', { bookingId, trackingStatus });
    return { booking_id: bookingId, tracking_status: trackingStatus, log_id: logEntry.id };
  }

  await booking.reload();
  const customerPickupOtp = customerVehiclePickupOtpFromBooking(booking.get({ plain: true }));
  const customerTrackingPayload = customerPickupOtp
    ? { ...socketPayload, pickup_otp: customerPickupOtp, vehicle_pickup_otp: customerPickupOtp }
    : socketPayload;
  emitToCustomer(customerId, 'booking_tracking_update', customerTrackingPayload);

  if (otp) {
    const otpMessage = `Please provide OTP to your service provider: ${otp}`;

    emitToCustomer(customerId, 'booking_status_update', {
      booking_id: bookingId,
      booking_status: 'OTP_GENERATED',
      message: otpMessage,
      otp,
      driver: driverDetails,
      updated_at: updatedAt
    });

    try {
      await ensureInboxNotification({
        userId: customerId,
        bookingId,
        notificationType: 'PICKUP_OTP',
        deliveryKey: `${bookingId}:PICKUP_OTP`,
        title: 'Vehicle Pickup OTP',
        message: otpMessage,
        data: {
          kind: 'PICKUP_OTP',
          booking_id: String(bookingId),
          otp
        }
      });
    } catch (err) {
      logger.error('tracking_otp_inbox_failed', {
        bookingId,
        customerId,
        message: err?.message,
        stack: err?.stack
      });
    }

    try {
      if (isOneSignalConfigured()) {
        await sendPushToUser(customerId, {
          title: 'Vehicle Pickup OTP',
          body: otpMessage,
          data: {
            kind: 'PICKUP_OTP',
            booking_id: String(bookingId),
            otp
          },
          idempotencyKey: `${bookingId}:PICKUP_OTP`
        });
      }
    } catch (err) {
      logger.error('tracking_otp_push_failed', {
        bookingId,
        customerId,
        message: err?.message,
        stack: err?.stack
      });
    }

    try {
      await notifyCustomerPickupOtp({ customerId, bookingId, otp });
    } catch (err) {
      logger.error('tracking_otp_sms_email_failed', {
        bookingId,
        customerId,
        message: err?.message,
        stack: err?.stack
      });
    }
  }

  const deliveryKey = `${bookingId}:TRACKING:${trackingStatus}`;

  let milestoneHandled = false;
  try {
    milestoneHandled = await notifyCustomerServiceMilestone({
      bookingId,
      customerId,
      trackingStatus,
      req,
    });
  } catch (err) {
    logger.error('customer_milestone_notify_failed', {
      bookingId,
      customerId,
      trackingStatus,
      message: err?.message,
      stack: err?.stack,
    });
  }

  if (!milestoneHandled && !shouldSuppressGenericCustomerPush(trackingStatus)) {
    try {
      await ensureInboxNotification({
        userId: customerId,
        bookingId,
        notificationType: 'TRACKING_UPDATE',
        deliveryKey,
        title: 'Booking Update',
        message,
        data: {
          kind: 'TRACKING_UPDATE',
          booking_id: String(bookingId),
          tracking_status: trackingStatus
        }
      });
    } catch (err) {
      logger.error('tracking_inbox_notification_failed', {
        bookingId,
        customerId,
        trackingStatus,
        message: err?.message,
        stack: err?.stack
      });
    }

    try {
      if (isOneSignalConfigured()) {
        await sendPushToUser(customerId, {
          title: 'Booking Update',
          body: message,
          data: {
            kind: 'TRACKING_UPDATE',
            booking_id: String(bookingId),
            tracking_status: trackingStatus
          },
          idempotencyKey: deliveryKey
        });
      }
    } catch (err) {
      logger.error('tracking_push_notification_failed', {
        bookingId,
        customerId,
        trackingStatus,
        message: err?.message,
        stack: err?.stack
      });
    }
  }

  return { booking_id: bookingId, tracking_status: trackingStatus, log_id: logEntry.id };
}

/**
 * Verify the pickup OTP submitted by the driver.
 * On success, advances tracking status to OTP_VERIFIED.
 */
async function verifyPickupOtp(bookingIdRaw, otpValue, auth) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Only service providers can verify OTP');

  const bookingId = parseBookingId(bookingIdRaw);
  const submittedOtp = String(otpValue || '').trim();

  if (!submittedOtp || submittedOtp.length !== 4) {
    throw new HttpError(400, 'OTP must be a 4-digit code');
  }

  const booking = await db.Booking.findByPk(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');

  const actor = Number(auth.userId);
  const assigned = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  if (!assigned || assigned !== actor) {
    throw new HttpError(403, 'You are not the assigned service provider for this booking');
  }

  if (!booking.pickup_otp) {
    throw new HttpError(409, 'No OTP has been generated for this booking');
  }

  if (booking.pickup_otp_expiry && new Date(booking.pickup_otp_expiry) < new Date()) {
    throw new HttpError(410, 'OTP has expired. Please ask the customer to request a new one.');
  }

  if (String(booking.pickup_otp) !== submittedOtp) {
    logger.warn('otp_verification_failed', { bookingId, driverUserId: actor });
    throw new HttpError(400, 'Invalid OTP');
  }

  const currentTracking = String(booking.tracking_status || '').trim().toUpperCase();
  const currentRank = resolveTrackingStatusRank(currentTracking);
  const otpVerifiedRank = resolveTrackingStatusRank('OTP_VERIFIED');
  const alreadyPastOtp =
    currentRank >= 0 && otpVerifiedRank >= 0 && currentRank >= otpVerifiedRank;

  if (alreadyPastOtp) {
    await booking.update({ pickup_otp: null, pickup_otp_expiry: null });
    return {
      booking_id: bookingId,
      tracking_status: currentTracking,
      verified: true,
      already_verified: true
    };
  }

  await booking.update({
    tracking_status: 'OTP_VERIFIED',
    pickup_otp: null,
    pickup_otp_expiry: null
  });

  const logEntry = await db.BookingTrackingLog.create({
    booking_id: bookingId,
    tracking_status: 'OTP_VERIFIED',
    message: TRACKING_STATUS_MESSAGES.OTP_VERIFIED,
    metadata: { driver_user_id: actor }
  });

  logger.info('otp_verified', { bookingId, driverUserId: actor, logId: logEntry.id });

  await cancelArrivalWaitTimers(bookingId).catch(() => {});
  await scheduleServiceDurationTimer(bookingId, new Date()).catch((err) => {
    logger.error('schedule_service_duration_timer_failed', { bookingId, message: err?.message });
  });

  const driverDetails = await loadDriverDetails(actor);
  const updatedAt = new Date().toISOString();

  const otpVerifiedPayload = {
    booking_id: bookingId,
    tracking_status: 'OTP_VERIFIED',
    message: TRACKING_STATUS_MESSAGES.OTP_VERIFIED,
    driver: driverDetails,
    updated_at: updatedAt
  };

  emitToBookingRoom(bookingId, 'booking_tracking_update', otpVerifiedPayload);

  const customerId = resolveCustomerId(booking.get({ plain: true }));
  if (customerId) {
    emitToCustomer(customerId, 'booking_tracking_update', otpVerifiedPayload);
    const deliveryKey = `${bookingId}:TRACKING:OTP_VERIFIED`;

    try {
      await ensureInboxNotification({
        userId: customerId,
        bookingId,
        notificationType: 'TRACKING_UPDATE',
        deliveryKey,
        title: 'OTP Verified',
        message: TRACKING_STATUS_MESSAGES.OTP_VERIFIED,
        data: {
          kind: 'TRACKING_UPDATE',
          booking_id: String(bookingId),
          tracking_status: 'OTP_VERIFIED'
        }
      });
    } catch (err) {
      logger.error('otp_verified_inbox_failed', {
        bookingId,
        customerId,
        message: err?.message,
        stack: err?.stack
      });
    }

    try {
      if (isOneSignalConfigured()) {
        await sendPushToUser(customerId, {
          title: 'OTP Verified',
          body: TRACKING_STATUS_MESSAGES.OTP_VERIFIED,
          data: {
            kind: 'TRACKING_UPDATE',
            booking_id: String(bookingId),
            tracking_status: 'OTP_VERIFIED'
          },
          idempotencyKey: deliveryKey
        });
      }
    } catch (err) {
      logger.error('otp_verified_push_failed', {
        bookingId,
        customerId,
        message: err?.message,
        stack: err?.stack
      });
    }
  }

  return { booking_id: bookingId, tracking_status: 'OTP_VERIFIED', verified: true };
}

/**
 * After driver confirms an alternate service location, rewind tracking from
 * SERVICE_LOCATION_ISSUE so the provider can drive to the updated stop.
 */
async function resetTrackingAfterAlternateServiceLocation(booking, driverUserId) {
  const bookingId = booking.id;
  const currentTracking = String(booking.tracking_status || '').trim().toUpperCase();
  const rewindFrom = new Set([
    'DRIVER_REACHED_SERVICE_CENTER',
    'VEHICLE_WAITING_IN_QUEUE',
    'SERVICE_LOCATION_ISSUE',
    'DRIVER_REACHED_NEXT_SERVICE_STOP',
  ]);
  if (!rewindFrom.has(currentTracking)) {
    return { tracking_status: currentTracking, changed: false, log_id: null };
  }

  const isComboSecondLeg =
    String(booking.service_type || '') === 'combo' &&
    Number(booking.combo_service_stop_index || 0) >= 1;
  const trackingStatus = isComboSecondLeg ? 'FIRST_SERVICE_COMPLETED' : 'VEHICLE_PICKED';
  const message = TRACKING_STATUS_MESSAGES[trackingStatus] || trackingStatus;
  const updatedAt = new Date().toISOString();

  await booking.update({ tracking_status: trackingStatus });

  const logEntry = await db.BookingTrackingLog.create({
    booking_id: bookingId,
    tracking_status: trackingStatus,
    message: 'Alternate service location confirmed. Heading to the updated stop.',
    metadata: {
      driver_user_id: driverUserId,
      reason: 'alternate_service_location',
      previous_tracking_status: currentTracking
    }
  });

  const driverDetails = await loadDriverDetails(driverUserId);
  const socketPayload = {
    booking_id: bookingId,
    tracking_status: trackingStatus,
    message,
    driver: driverDetails,
    updated_at: updatedAt
  };

  emitToBookingRoom(bookingId, 'booking_tracking_update', socketPayload);

  const customerId = resolveCustomerId(booking.get({ plain: true }));
  if (customerId) {
    emitToCustomer(customerId, 'booking_tracking_update', socketPayload);
  }

  logger.info('tracking_reset_after_alternate_location', {
    bookingId,
    driverUserId,
    from: currentTracking,
    to: trackingStatus,
    logId: logEntry.id
  });

  return {
    tracking_status: trackingStatus,
    changed: true,
    log_id: logEntry.id
  };
}

module.exports = {
  applyTrackingStatus,
  verifyPickupOtp,
  resetTrackingAfterAlternateServiceLocation
};
