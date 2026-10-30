'use strict';

const { BOOKING_IMAGE_TYPES } = require('../constants/bookingImageTypes');
const { ensureAbsoluteUrl } = require('./fileUpload');

function formatBookingImagesForResponse(req, imagesRaw) {
  const images = Array.isArray(imagesRaw) ? imagesRaw : [];
  const booking_images = images.map((img) => {
    const image_type = img.image_type || BOOKING_IMAGE_TYPES.CUSTOMER;
    return {
      id: img.id,
      image_url: ensureAbsoluteUrl(req, img.image_url),
      image_type,
      type: image_type,
      created_at: img.created_at
    };
  });

  return {
    service_images: {
      before: booking_images.filter((i) => i.image_type === BOOKING_IMAGE_TYPES.BEFORE_SERVICE),
      after: booking_images.filter((i) => i.image_type === BOOKING_IMAGE_TYPES.AFTER_SERVICE),
      customer: booking_images.filter((i) => i.image_type === BOOKING_IMAGE_TYPES.CUSTOMER)
    }
  };
}

module.exports = { formatBookingImagesForResponse };
