const { createBookingReview, listBookingReviews } = require('../services/review.service');

function pickReviewImageFiles(req) {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  const a = req.files.images || req.files['images[]'];
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

async function postBookingReview(req, res, next) {
  try {
    const auth = req.auth || {};
    const files = pickReviewImageFiles(req);
    const data = await createBookingReview({ bookingId: req.params.id, auth, body: req.body, files, req });
    return res.success('Review submitted', data);
  } catch (err) {
    return next(err);
  }
}

async function getBookingReviews(req, res, next) {
  try {
    const auth = req.auth || {};
    const data = await listBookingReviews({ bookingId: req.params.id, auth, req });
    return res.success('Reviews fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { postBookingReview, getBookingReviews };

