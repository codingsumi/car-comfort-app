'use strict';

const { uploadBookingServiceImages } = require('../services/bookingServiceImages.service');
const { BOOKING_IMAGE_TYPES } = require('../constants/bookingImageTypes');

function pickImageFiles(req) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  const a = req.files.images || req.files['images[]'];
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

async function postBeforeServiceImages(req, res, next) {
  try {
    const files = pickImageFiles(req);
    const data = await uploadBookingServiceImages(req, {
      bookingId: req.params.id,
      auth: req.auth,
      imageType: BOOKING_IMAGE_TYPES.BEFORE_SERVICE,
      files
    });
    return res.success('Before-service images uploaded', data);
  } catch (err) {
    return next(err);
  }
}

async function postAfterServiceImages(req, res, next) {
  try {
    const files = pickImageFiles(req);
    const data = await uploadBookingServiceImages(req, {
      bookingId: req.params.id,
      auth: req.auth,
      imageType: BOOKING_IMAGE_TYPES.AFTER_SERVICE,
      files
    });
    return res.success('After-service images uploaded', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { postBeforeServiceImages, postAfterServiceImages };
