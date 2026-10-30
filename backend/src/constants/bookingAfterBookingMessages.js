'use strict';

/**
 * Customer / provider copy after booking — from Notification.docx (booking flows only).
 */

const CUSTOMER_ON_DEMAND_AFTER_BOOKING =
  "Thank you for booking CarComfort. We'll notify you as soon as service provider becomes available in your area. Please use the app to communicate safely and coordinate key exchange, ETA, including any special vehicle instructions. Please make sure your vehicle is safe to operate and has enough fuel or charge to reach the nearest service location. We are not responsible if your vehicle cannot reach the nearby service location due to pre-existing conditions. For EV owners, please make sure the bank card connected to your EV account has enough funds, otherwise you may incur charges on your final billing summary.\n\nThank you for your understanding, and we hope you enjoy our premium valet service.";

const CUSTOMER_ON_DEMAND_PROVIDER_ASSIGNED =
  'Hello, your service provider has been assigned and is preparing to head toward the pick-up location';

const CUSTOMER_SCHEDULED_PROVIDER_ASSIGNED =
  "Hello, your service provider has been assigned. We'll notify you if anything changes before your scheduled appointment. Please use the app to communicate safely and coordinate key exchange, ETA, including any special vehicle instructions. Please make sure your vehicle is in good driving condition and has sufficient fuel or charge to reach the nearest EV charging station or car wash location.";

const CUSTOMER_SCHEDULED_ONE_HOUR_REMINDER =
  'Hello, your service provider is getting ready to head toward the vehicle pick-up location.';

const PROVIDER_ON_DEMAND_AFTER_ACCEPT =
  'Hello, thank you for accepting this booking. This is an on-demand service, and you have up to 15 minutes to begin heading to the vehicle pick-up location. If you do not start within that time, the job may be reassigned or returned to the job board.';

const PROVIDER_SCHEDULED_AFTER_ACCEPT =
  'Hello, and thank you for accepting this booking. This is a scheduled service job. On the day of service, please begin heading to the vehicle pick-up location at least one hour in advance. If you do not start within that time, the job may be reassigned or returned to the job board.';

function normalizeScheduleType(scheduleType) {
  return String(scheduleType || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

function isOnDemandScheduleType(scheduleType) {
  const t = normalizeScheduleType(scheduleType);
  return t === 'on_demand' || t === 'asap';
}

function isScheduledScheduleType(scheduleType) {
  return normalizeScheduleType(scheduleType) === 'scheduled';
}

/** Scheduled service reminders — includes legacy rows with service time but null schedule_type. */
function isScheduledBookingForReminders(booking) {
  if (!booking || typeof booking !== 'object') return false;
  const scheduleType = booking.schedule_type ?? booking.scheduleType;
  if (isOnDemandScheduleType(scheduleType)) return false;
  if (isScheduledScheduleType(scheduleType)) return true;
  const serviceAt = booking.scheduled_at ?? booking.scheduledAt ?? booking.service_datetime ?? booking.serviceDatetime;
  return Boolean(serviceAt);
}

function getCustomerBookingConfirmedMessage(scheduleType) {
  if (isOnDemandScheduleType(scheduleType)) {
    return {
      title: 'Thanks for booking',
      body: CUSTOMER_ON_DEMAND_AFTER_BOOKING,
      sms: CUSTOMER_ON_DEMAND_AFTER_BOOKING
    };
  }
  return null;
}

function getCustomerProviderAssignedMessage(scheduleType) {
  if (isScheduledScheduleType(scheduleType)) {
    return {
      title: 'Service provider assigned',
      body: CUSTOMER_SCHEDULED_PROVIDER_ASSIGNED
    };
  }
  return {
    title: 'Service provider assigned',
    body: CUSTOMER_ON_DEMAND_PROVIDER_ASSIGNED
  };
}

function getCustomerScheduledOneHourReminderMessage() {
  return {
    title: 'Upcoming service',
    body: CUSTOMER_SCHEDULED_ONE_HOUR_REMINDER
  };
}

function getProviderAfterAcceptMessage(scheduleType) {
  if (isScheduledScheduleType(scheduleType)) {
    return {
      title: 'Scheduled booking accepted',
      body: PROVIDER_SCHEDULED_AFTER_ACCEPT
    };
  }
  return {
    title: 'On-demand booking accepted',
    body: PROVIDER_ON_DEMAND_AFTER_ACCEPT
  };
}

module.exports = {
  CUSTOMER_ON_DEMAND_AFTER_BOOKING,
  CUSTOMER_ON_DEMAND_PROVIDER_ASSIGNED,
  CUSTOMER_SCHEDULED_PROVIDER_ASSIGNED,
  CUSTOMER_SCHEDULED_ONE_HOUR_REMINDER,
  PROVIDER_ON_DEMAND_AFTER_ACCEPT,
  PROVIDER_SCHEDULED_AFTER_ACCEPT,
  isOnDemandScheduleType,
  isScheduledScheduleType,
  isScheduledBookingForReminders,
  getCustomerBookingConfirmedMessage,
  getCustomerProviderAssignedMessage,
  getCustomerScheduledOneHourReminderMessage,
  getProviderAfterAcceptMessage
};
