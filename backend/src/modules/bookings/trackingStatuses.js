'use strict';

const TRACKING_STATUSES = [
  'DRIVER_STARTED_TO_CUSTOMER',
  'DRIVER_NEAR_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER',
  'OTP_PENDING',
  'OTP_VERIFIED',
  'VEHICLE_PICKED',
  'DRIVER_STARTED_TO_SERVICE_CENTER',
  'DRIVER_REACHED_SERVICE_CENTER',
  'VEHICLE_WAITING_IN_QUEUE',
  'SERVICE_LOCATION_ISSUE',
  'SERVICE_STARTED',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'FIRST_SERVICE_COMPLETED',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP',
  'DRIVER_REACHED_NEXT_SERVICE_STOP',
  'SECOND_SERVICE_STARTED',
  'SECOND_SERVICE_IN_PROGRESS',
  'SECOND_SERVICE_COMPLETED',
  'BEFORE_IMAGES_UPLOADED',
  'AFTER_IMAGES_UPLOADED',
  'DRIVER_LEFT_SERVICE_CENTER',
  'DRIVER_RETURNING_TO_CUSTOMER',
  'DRIVER_REACHED_CUSTOMER_RETURN',
  'VEHICLE_DELIVERED'
];

const TRACKING_STATUSES_SET = new Set(TRACKING_STATUSES);

/** Monotonic journey order — used to reject tracking status rollback. */
const TRACKING_STATUS_RANK = Object.freeze({
  DRIVER_STARTED_TO_CUSTOMER: 10,
  DRIVER_NEAR_CUSTOMER: 20,
  DRIVER_REACHED_CUSTOMER: 30,
  OTP_PENDING: 35,
  OTP_VERIFIED: 40,
  BEFORE_IMAGES_UPLOADED: 45,
  VEHICLE_PICKED: 50,
  DRIVER_STARTED_TO_SERVICE_CENTER: 60,
  DRIVER_REACHED_SERVICE_CENTER: 70,
  VEHICLE_WAITING_IN_QUEUE: 75,
  SERVICE_LOCATION_ISSUE: 82,
  SERVICE_STARTED: 80,
  SERVICE_IN_PROGRESS: 85,
  SERVICE_COMPLETED: 90,
  FIRST_SERVICE_COMPLETED: 91,
  DRIVER_HEADING_TO_NEXT_SERVICE_STOP: 92,
  DRIVER_REACHED_NEXT_SERVICE_STOP: 93,
  SECOND_SERVICE_STARTED: 94,
  SECOND_SERVICE_IN_PROGRESS: 95,
  SECOND_SERVICE_COMPLETED: 96,
  DRIVER_LEFT_SERVICE_CENTER: 100,
  DRIVER_RETURNING_TO_CUSTOMER: 110,
  DRIVER_REACHED_CUSTOMER_RETURN: 120,
  AFTER_IMAGES_UPLOADED: 125,
  VEHICLE_DELIVERED: 130
});

function resolveTrackingStatusRank(status) {
  const key = String(status || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRACKING_STATUS_RANK, key)
    ? TRACKING_STATUS_RANK[key]
    : -1;
}

const TRACKING_STATUS_MESSAGES = {
  DRIVER_STARTED_TO_CUSTOMER: 'Your service provider is heading to the vehicle pick-up location.',
  DRIVER_NEAR_CUSTOMER: 'Your service provider is arriving soon',
  DRIVER_REACHED_CUSTOMER: 'Your service provider has arrived at the vehicle pick-up location.',
  OTP_PENDING: 'Please share the OTP with your service provider',
  OTP_VERIFIED: 'OTP verified successfully',
  VEHICLE_PICKED: 'Your vehicle has been picked up',
  DRIVER_STARTED_TO_SERVICE_CENTER: 'Your vehicle is en route to be serviced',
  DRIVER_REACHED_SERVICE_CENTER:
    'Your vehicle has arrived for service. Please help our service provider with necessary assistance regarding your vehicle if needed.',
  VEHICLE_WAITING_IN_QUEUE: 'Your vehicle is waiting to be serviced. We will notify you as soon as service begins.',
  SERVICE_LOCATION_ISSUE: 'There is an issue at the service location. Your provider is working to resolve it.',
  SERVICE_STARTED: 'Your vehicle is currently being serviced',
  SERVICE_IN_PROGRESS: 'Your vehicle is currently being serviced',
  SERVICE_COMPLETED: 'Service has been completed',
  FIRST_SERVICE_COMPLETED: 'EV charging has been completed',
  DRIVER_HEADING_TO_NEXT_SERVICE_STOP: 'Your vehicle is en route to the car wash',
  DRIVER_REACHED_NEXT_SERVICE_STOP:
    'Your vehicle has arrived for service. Please help our service provider with necessary assistance regarding your vehicle if needed.',
  SECOND_SERVICE_STARTED: 'Your vehicle is currently being serviced',
  SECOND_SERVICE_IN_PROGRESS: 'Your vehicle is currently being serviced',
  SECOND_SERVICE_COMPLETED: 'Car wash has been completed',
  BEFORE_IMAGES_UPLOADED: "Here's your pre-service photos. Your vehicle is en-route to be serviced.",
  AFTER_IMAGES_UPLOADED: 'Your after-service photos are now available',
  DRIVER_LEFT_SERVICE_CENTER: 'Your vehicle is en route back to you/drop off location.',
  DRIVER_RETURNING_TO_CUSTOMER: 'Your service provider is on the way to return your vehicle',
  DRIVER_REACHED_CUSTOMER_RETURN: 'Your service provider has arrived at the vehicle drop-off location.',
  VEHICLE_DELIVERED:
    'Thank you for choosing CarComfort. Your after-service photos and final billing are now available.',
};

module.exports = {
  TRACKING_STATUSES,
  TRACKING_STATUSES_SET,
  TRACKING_STATUS_RANK,
  TRACKING_STATUS_MESSAGES,
  resolveTrackingStatusRank
};
