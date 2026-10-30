const {
  startBooking,
  updateBookingLocation,
  updateServiceDetails,
  updateVehicleDetails,
  uploadBookingImages,
  getBookingReview,
  confirmBooking,
  getEvChargingOptions,
} = require('../services/bookingV2.service');

function getAuthUserIdOrThrow(req) {
  const userId = req.auth?.userId;
  if (!userId) {
    const { HttpError } = require('../utils/httpError');
    throw new HttpError(401, 'Unauthorized');
  }
  return userId;
}

function pickImageFiles(req) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  const a = req.files.images || req.files['images[]'];
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

async function start(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const data = await startBooking(req, { userId, body: req.body });
    return res.success('Booking started', data);
  } catch (err) {
    return next(err);
  }
}

async function putLocation(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const data = await updateBookingLocation(req, {
      bookingId: req.params.id,
      userId,
      body: req.body,
    });
    return res.success('Location updated', data);
  } catch (err) {
    return next(err);
  }
}

async function putService(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const data = await updateServiceDetails({ bookingId: req.params.id, userId, body: req.body });
    return res.success('Service details saved', data);
  } catch (err) {
    return next(err);
  }
}

async function putVehicle(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const files = pickImageFiles(req);
    const data = await updateVehicleDetails(req, { bookingId: req.params.id, userId, body: req.body, files });
    return res.success('Vehicle details saved', data);
  } catch (err) {
    return next(err);
  }
}

async function postImages(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const files = pickImageFiles(req);
    const data = await uploadBookingImages(req, { bookingId: req.params.id, userId, files });
    return res.success('Images uploaded', data);
  } catch (err) {
    return next(err);
  }
}

async function review(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const data = await getBookingReview(req, { bookingId: req.params.id, userId });
    return res.success('Booking review', data);
  } catch (err) {
    return next(err);
  }
}

async function confirm(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const data = await confirmBooking({ bookingId: req.params.id, userId, body: req.body });
    return res.success('Booking confirmed', data);
  } catch (err) {
    return next(err);
  }
}

async function evChargingOptions(_req, res, next) {
  try {
    const data = getEvChargingOptions();
    return res.success('EV charging booking options', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  start,
  putLocation,
  putService,
  putVehicle,
  postImages,
  review,
  confirm,
  evChargingOptions,
};

