'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { ensureAbsoluteUrl } = require('../utils/fileUpload');
const { BOOKING_IMAGE_TYPES } = require('../constants/bookingImageTypes');
const { ensureInboxNotification } = require('../modules/notifications/inboxNotification.service');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');

const CUSTOMER_MILESTONE_KIND = 'CUSTOMER_SERVICE_MILESTONE';

const MILESTONE_KEYS = {
  PRE_SERVICE: 'pre_service_en_route',
  ARRIVED_AT_SERVICE: 'arrived_at_service',
  VEHICLE_WAITING_IN_QUEUE: 'vehicle_waiting_in_queue',
  SERVICE_LOCATION_ISSUE: 'service_location_issue',
  RETURN_EN_ROUTE: 'return_en_route',
  SERVICE_COMPLETE: 'service_complete',
  SERVICE_IN_PROGRESS: 'service_in_progress',
};

/** Statuses that should not send the generic TRACKING_UPDATE customer push. */
const SUPPRESS_GENERIC_CUSTOMER_PUSH = new Set([
  'DRIVER_STARTED_TO_SERVICE_CENTER',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
  'DRIVER_REACHED_SERVICE_CENTER',
  'DRIVER_REACHED_NEXT_SERVICE_STOP',
  'BEFORE_IMAGES_UPLOADED',
  'VEHICLE_WAITING_IN_QUEUE',
  'SERVICE_LOCATION_ISSUE',
  'SERVICE_STARTED',
  'SERVICE_IN_PROGRESS',
  'SECOND_SERVICE_STARTED',
  'SECOND_SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'FIRST_SERVICE_COMPLETED',
  'SECOND_SERVICE_COMPLETED',
  'DRIVER_LEFT_SERVICE_CENTER',
  'DRIVER_RETURNING_TO_CUSTOMER',
  'AFTER_IMAGES_UPLOADED',
  'VEHICLE_DELIVERED',
]);

async function loadServiceImageUrls(bookingId, imageType, req) {
  const rows = await db.BookingImage.findAll({
    where: { booking_id: bookingId, image_type: imageType },
    order: [['id', 'ASC']],
    attributes: ['image_url'],
  });
  return rows
    .map((row) => ensureAbsoluteUrl(req, row.image_url))
    .filter((url) => String(url || '').trim());
}

async function milestoneAlreadySent(bookingId, milestoneKey) {
  const deliveryKey = `${bookingId}:CUSTOMER_MILESTONE:${milestoneKey}`;
  const existing = await db.AppNotification.findOne({
    where: { delivery_key: deliveryKey },
    attributes: ['id'],
  });
  return Boolean(existing);
}

async function sendCustomerMilestoneNotification({
  bookingId,
  customerId,
  trackingStatus,
  milestoneKey,
  title,
  message,
  data = {},
  req,
}) {
  const deliveryKey = `${bookingId}:CUSTOMER_MILESTONE:${milestoneKey}`;
  const payloadData = {
    kind: CUSTOMER_MILESTONE_KIND,
    milestone: milestoneKey,
    booking_id: String(bookingId),
    tracking_status: trackingStatus,
    ...data,
  };

  try {
    await ensureInboxNotification({
      userId: customerId,
      bookingId,
      notificationType: 'TRACKING_UPDATE',
      deliveryKey,
      title,
      message,
      data: payloadData,
    });
  } catch (err) {
    logger.error('customer_milestone_inbox_failed', {
      bookingId,
      customerId,
      milestoneKey,
      message: err?.message,
    });
  }

  try {
    if (isOneSignalConfigured()) {
      await sendPushToUser(customerId, {
        title,
        body: message,
        data: payloadData,
        idempotencyKey: deliveryKey,
      });
    }
  } catch (err) {
    logger.error('customer_milestone_push_failed', {
      bookingId,
      customerId,
      milestoneKey,
      message: err?.message,
    });
  }
}

async function notifyPreServiceMilestone({ bookingId, customerId, trackingStatus, req }) {
  const enRouteStatuses = new Set([
    'DRIVER_STARTED_TO_SERVICE_CENTER',
    'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
  ]);
  const isEnRoute = enRouteStatuses.has(trackingStatus);
  const isPhotoUpload = trackingStatus === 'BEFORE_IMAGES_UPLOADED';

  const beforePhotos = await loadServiceImageUrls(
    bookingId,
    BOOKING_IMAGE_TYPES.BEFORE_SERVICE,
    req
  );
  const photosSent = await milestoneAlreadySent(bookingId, `${MILESTONE_KEYS.PRE_SERVICE}:photos`);
  const enRouteSent = await milestoneAlreadySent(bookingId, `${MILESTONE_KEYS.PRE_SERVICE}:en_route`);

  if (isPhotoUpload && !photosSent) {
    await sendCustomerMilestoneNotification({
      bookingId,
      customerId,
      trackingStatus,
      milestoneKey: `${MILESTONE_KEYS.PRE_SERVICE}:photos`,
      title: 'Pre-service photos',
      // Do NOT mention 'en route' here — the vehicle has not started moving yet.
      // The en-route notification fires separately when the provider taps
      // 'Head to Service' (DRIVER_STARTED_TO_SERVICE_CENTER).
      message: "Here's your pre-service photos. Tap to see your booking details.",
      data: {
        before_service_photos: beforePhotos,
        has_before_service_photos: beforePhotos.length > 0,
        open_booking_detail: true,
      },
      req,
    });
  }

  if (isEnRoute && !enRouteSent) {
    await sendCustomerMilestoneNotification({
      bookingId,
      customerId,
      trackingStatus,
      milestoneKey: `${MILESTONE_KEYS.PRE_SERVICE}:en_route`,
      title: 'Vehicle en route to service',
      // Do NOT mention pre-service photos here — they have not been uploaded yet.
      // A separate notification fires on BEFORE_IMAGES_UPLOADED once photos are ready.
      message: 'Your vehicle is en route to be serviced.',
      data: {},
      req,
    });
  }

  return isPhotoUpload || isEnRoute;
}

async function notifyVehicleWaitingInQueueMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.VEHICLE_WAITING_IN_QUEUE)) {
    return true;
  }

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.VEHICLE_WAITING_IN_QUEUE,
    title: 'Vehicle waiting in queue',
    message: 'Your vehicle is waiting to be serviced. We will notify you as soon as service begins.',
    req,
  });
  return true;
}

async function notifyServiceLocationIssueMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.SERVICE_LOCATION_ISSUE)) {
    return true;
  }

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.SERVICE_LOCATION_ISSUE,
    title: 'Issue at service location',
    message: 'There is an issue at the service location. Your provider is working to resolve it.',
    req,
  });
  return true;
}

async function notifyArrivedAtServiceMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.ARRIVED_AT_SERVICE)) {
    return true;
  }

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.ARRIVED_AT_SERVICE,
    title: 'Vehicle arrived for service',
    message:
      'Your vehicle has arrived for service. Please help our service provider with necessary assistance regarding your vehicle if needed.',
    req,
  });
  return true;
}

async function notifyServiceInProgressMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.SERVICE_IN_PROGRESS)) {
    return true;
  }

  // Load pre-service (before) photos so the customer can tap through and view them.
  const beforePhotos = await loadServiceImageUrls(
    bookingId,
    BOOKING_IMAGE_TYPES.BEFORE_SERVICE,
    req
  );

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.SERVICE_IN_PROGRESS,
    title: 'Service started',
    message:
      'Your service has started. Pre-service photos are now available — tap to view your booking details.',
    data: {
      open_booking_detail: true,
      before_service_photos: beforePhotos,
      has_before_service_photos: beforePhotos.length > 0,
    },
    req,
  });
  return true;
}

async function notifyReturnEnRouteMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.RETURN_EN_ROUTE)) {
    return true;
  }

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.RETURN_EN_ROUTE,
    title: 'Vehicle returning to you',
    message: 'Your vehicle is en route back to you/drop off location.',
    req,
  });
  return true;
}

async function notifyServiceCompleteMilestone({ bookingId, customerId, trackingStatus, req }) {
  if (await milestoneAlreadySent(bookingId, MILESTONE_KEYS.SERVICE_COMPLETE)) {
    return true;
  }

  const afterPhotos = await loadServiceImageUrls(
    bookingId,
    BOOKING_IMAGE_TYPES.AFTER_SERVICE,
    req
  );

  await sendCustomerMilestoneNotification({
    bookingId,
    customerId,
    trackingStatus,
    milestoneKey: MILESTONE_KEYS.SERVICE_COMPLETE,
    title: 'Service complete',
    message:
      'Your service is complete! After-service photos and your final invoice are now available — tap to view.',
    data: {
      after_service_photos: afterPhotos,
      has_after_service_photos: afterPhotos.length > 0,
      show_billing: true,
      open_billing_history: true,
      // Signal the Flutter handler to open the specific booking invoice page.
      open_invoice: true,
    },
    req,
  });
  return true;
}

/**
 * Sends customer milestone push/inbox notifications for key service journey events.
 * Returns true when a milestone notification was handled (suppress generic push).
 */
async function notifyCustomerServiceMilestone({
  bookingId,
  customerId,
  trackingStatus,
  req,
}) {
  const status = String(trackingStatus || '').trim().toUpperCase();
  if (!customerId || !status) return false;

  if (
    status === 'BEFORE_IMAGES_UPLOADED' ||
    status === 'DRIVER_STARTED_TO_SERVICE_CENTER' ||
    status === 'DRIVER_HEADING_TO_NEXT_SERVICE_STOP'
  ) {
    return notifyPreServiceMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (status === 'DRIVER_REACHED_SERVICE_CENTER' || status === 'DRIVER_REACHED_NEXT_SERVICE_STOP') {
    return notifyArrivedAtServiceMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (status === 'VEHICLE_WAITING_IN_QUEUE') {
    return notifyVehicleWaitingInQueueMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (status === 'SERVICE_LOCATION_ISSUE') {
    return notifyServiceLocationIssueMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (
    status === 'SERVICE_STARTED' ||
    status === 'SERVICE_IN_PROGRESS' ||
    status === 'SECOND_SERVICE_STARTED' ||
    status === 'SECOND_SERVICE_IN_PROGRESS'
  ) {
    return notifyServiceInProgressMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (status === 'DRIVER_RETURNING_TO_CUSTOMER') {
    return notifyReturnEnRouteMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  if (status === 'VEHICLE_DELIVERED') {
    return notifyServiceCompleteMilestone({ bookingId, customerId, trackingStatus: status, req });
  }

  return false;
}

function shouldSuppressGenericCustomerPush(trackingStatus) {
  return SUPPRESS_GENERIC_CUSTOMER_PUSH.has(String(trackingStatus || '').trim().toUpperCase());
}

module.exports = {
  notifyCustomerServiceMilestone,
  shouldSuppressGenericCustomerPush,
  CUSTOMER_MILESTONE_KIND,
  MILESTONE_KEYS,
};
