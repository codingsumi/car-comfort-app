'use strict';

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { bufferToWebp, saveWebpFile, ensureAbsoluteUrl } = require('../utils/fileUpload');
const { applyTrackingStatus } = require('../modules/bookings/bookingTracking.service');
const { resolveTrackingStatusRank } = require('../modules/bookings/trackingStatuses');
const {
  BOOKING_IMAGE_TYPES,
  SERVICE_IMAGE_TYPES,
  TRACKING_STATUS_BY_IMAGE_TYPE
} = require('../constants/bookingImageTypes');

const INELIGIBLE_BOOKING_STATUSES = new Set(['draft', 'pending_payment', 'cancelled', 'completed']);

function parseBookingId(idRaw) {
  const id = Number.parseInt(String(idRaw), 10);
  if (!id || id < 1) throw new HttpError(400, 'booking id is invalid');
  return id;
}

function assertDriverAuth(auth) {
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (String(auth.role) !== 'driver') throw new HttpError(403, 'Only service providers can upload service images');
}

function normalizeImageType(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!SERVICE_IMAGE_TYPES.has(value)) {
    throw new HttpError(400, 'image_type must be before_service or after_service');
  }
  return value;
}

function formatImageRow(req, plain) {
  return {
    ...plain,
    image_url: ensureAbsoluteUrl(req, plain.image_url)
  };
}

async function uploadBookingServiceImages(req, { bookingId: bookingIdRaw, auth, imageType: imageTypeRaw, files }) {
  assertDriverAuth(auth);
  const bookingId = parseBookingId(bookingIdRaw);
  const imageType = normalizeImageType(imageTypeRaw);

  if (!Array.isArray(files) || files.length === 0) {
    throw new HttpError(400, 'No images uploaded');
  }

  const booking = await db.Booking.findByPk(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');

  const actor = Number(auth.userId);
  const assigned = Number(booking.provider_id || booking.assigned_driver_user_id || 0);
  if (!assigned || assigned !== actor) {
    throw new HttpError(403, 'You are not the assigned service provider for this booking');
  }

  if (INELIGIBLE_BOOKING_STATUSES.has(String(booking.status))) {
    throw new HttpError(409, 'Booking is not eligible for service image uploads');
  }

  if (imageType === BOOKING_IMAGE_TYPES.BEFORE_SERVICE) {
    const currentTracking = String(booking.tracking_status || '').trim().toUpperCase();
    const currentRank = resolveTrackingStatusRank(currentTracking);
    const otpVerifiedRank = resolveTrackingStatusRank('OTP_VERIFIED');
    if (otpVerifiedRank >= 0 && (currentRank < 0 || currentRank < otpVerifiedRank)) {
      throw new HttpError(
        403,
        'Verify the customer security PIN before uploading before-service photos'
      );
    }
  }

  if (imageType === BOOKING_IMAGE_TYPES.AFTER_SERVICE) {
    const beforeCount = await db.BookingImage.count({
      where: { booking_id: bookingId, image_type: BOOKING_IMAGE_TYPES.BEFORE_SERVICE }
    });
    if (!beforeCount) {
      throw new HttpError(400, 'Upload before-service images before after-service images');
    }
  }

  const bookingFolder = booking.booking_code ? String(booking.booking_code) : `booking-${booking.id}`;
  const uploadDir = `bookings/${bookingFolder}/service-images/${imageType}`;
  const created = [];

  const t = await db.sequelize.transaction();
  try {
    for (const file of files) {
      const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
      const saved = await saveWebpFile({
        buffer: webp,
        uploadDir,
        req,
        fileBaseName: file.originalname || 'service'
      });
      const row = await db.BookingImage.create(
        {
          booking_id: bookingId,
          image_url: saved.publicPath,
          image_type: imageType
        },
        { transaction: t }
      );
      created.push(formatImageRow(req, row.get({ plain: true })));
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const trackingStatus = TRACKING_STATUS_BY_IMAGE_TYPE[imageType];
  await booking.reload();
  const currentTracking = String(booking.tracking_status || '').trim().toUpperCase();
  let tracking = null;

  if (trackingStatus && currentTracking !== trackingStatus) {
    const currentRank = resolveTrackingStatusRank(currentTracking);
    const nextRank = resolveTrackingStatusRank(trackingStatus);
    if (currentRank >= 0 && nextRank >= 0 && nextRank < currentRank) {
      logger.info('service_image_tracking_skip_backward', {
        bookingId,
        currentTracking,
        trackingStatus
      });
    } else {
      tracking = await applyTrackingStatus(bookingId, trackingStatus, auth, req);
    }
  }

  return {
    booking_id: bookingId,
    image_type: imageType,
    images: created,
    tracking_status: tracking?.tracking_status || currentTracking || null
  };
}

module.exports = { uploadBookingServiceImages };
