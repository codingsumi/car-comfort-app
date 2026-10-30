const { Op, fn, col } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { bufferToWebp, saveWebpFile, ensureAbsoluteUrl } = require('../utils/fileUpload');

function parseId(v, name) {
  const n = Number.parseInt(String(v), 10);
  if (!n || n < 1) throw new HttpError(400, `${name} must be a positive integer`);
  return n;
}

function normalizeRating(v) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) throw new HttpError(400, 'rating must be 1-5');
  return n;
}

function normalizeMessage(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 2000) throw new HttpError(400, 'message must be <= 2000 chars');
  return s;
}

function normalizeSatisfied(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v === true || v === false) return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  throw new HttpError(400, 'is_satisfied must be boolean');
}

function getAuthOrThrow(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId || !['customer', 'driver', 'admin'].includes(role)) throw new HttpError(401, 'Unauthorized');
  return { userId, role };
}

function getCounterparty({ booking, role }) {
  if (role === 'customer') {
    if (!booking.assigned_driver_user_id) throw new HttpError(400, 'Service provider not assigned yet');
    return { reviewer_role: 'customer', reviewee_role: 'driver', reviewee_user_id: booking.assigned_driver_user_id };
  }
  if (role === 'driver') {
    if (!booking.user_id) throw new HttpError(400, 'Customer missing');
    return { reviewer_role: 'driver', reviewee_role: 'customer', reviewee_user_id: booking.user_id };
  }
  throw new HttpError(403, 'Forbidden');
}

async function createBookingReview({ bookingId, auth, body, files = [], req }) {
  const { userId, role } = getAuthOrThrow(auth);
  if (role === 'admin') throw new HttpError(403, 'Forbidden');

  const id = parseId(bookingId, 'bookingId');

  const booking = await db.Booking.findOne({
    where:
      role === 'customer'
        ? { id, user_id: userId }
        : role === 'driver'
          ? { id, assigned_driver_user_id: userId }
          : { id },
    attributes: ['id', 'booking_code', 'status', 'user_id', 'assigned_driver_user_id']
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status !== 'completed') throw new HttpError(400, 'Review is allowed only after completion');

  const counterparty = getCounterparty({ booking, role });

  const rating = normalizeRating(body?.rating);
  const message = normalizeMessage(body?.message);
  const is_satisfied = normalizeSatisfied(body?.is_satisfied);

  if (role === 'driver' && files.length) {
    throw new HttpError(400, 'Drivers cannot upload review images');
  }

  try {
    const t = await db.sequelize.transaction();
    try {
      const { analyzeReviewContent } = require('../utils/userContentSanitize');
      const scan = await analyzeReviewContent({
        message,
        rating,
        reviewerUserId: userId,
      });

      let moderation_status = 'pending';
      let flags_count = 0;
      let auto_flag_reasons = null;
      if (scan.shouldAutoFlag) {
        moderation_status = 'flagged';
        flags_count = Math.max(1, scan.flagsIncrement);
        auto_flag_reasons = scan.reasons;
      } else if (scan.reasons.length) {
        flags_count = scan.flagsIncrement;
        auto_flag_reasons = scan.reasons;
      }

      const row = await db.Review.create(
        {
          booking_id: booking.id,
          reviewer_user_id: userId,
          reviewee_user_id: counterparty.reviewee_user_id,
          reviewer_role: counterparty.reviewer_role,
          reviewee_role: counterparty.reviewee_role,
          rating,
          message,
          is_satisfied,
          moderation_status,
          flags_count,
          auto_flag_reasons,
          last_auto_scan_at: message ? new Date() : null,
        },
        { transaction: t }
      );

      const createdImages = [];
      if (role === 'customer' && files.length) {
        if (!req) throw new HttpError(500, 'Request context missing');

        const bookingFolder = booking.booking_code ? String(booking.booking_code).trim().toLowerCase() : String(booking.id);
        const uploadDir = `reviews/${bookingFolder}/review-${row.id}`;
        for (const file of files.slice(0, 10)) {
          // eslint-disable-next-line no-await-in-loop
          const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
          // eslint-disable-next-line no-await-in-loop
          const saved = await saveWebpFile({
            buffer: webp,
            uploadDir,
            req,
            fileBaseName: file.originalname || 'review'
          });
          // eslint-disable-next-line no-await-in-loop
          const img = await db.ReviewImage.create(
            { review_id: row.id, image_url: saved.absoluteUrl },
            { transaction: t }
          );
          createdImages.push(img.get({ plain: true }));
        }
      }

      await t.commit();

      const plain = row.get({ plain: true });

      if (
        counterparty.reviewer_role === 'customer' &&
        counterparty.reviewee_role === 'driver' &&
        booking.assigned_driver_user_id
      ) {
        const { notifyDriverCustomerReview } = require('./driverNotify.service');
        void notifyDriverCustomerReview({
          booking,
          review: plain,
          customerUserId: userId,
        }).catch((err) => {
          const { logger } = require('../config/logger');
          logger.warn('notify_driver_customer_review_failed', {
            bookingId: booking.id,
            providerId: booking.assigned_driver_user_id,
            message: err?.message,
          });
        });
      }

      return {
        ...plain,
        images: createdImages.map((i) => i.image_url)
      };
    } catch (e2) {
      await t.rollback();
      throw e2;
    }
  } catch (e) {
    if (String(e?.name || '') === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'Review already submitted');
    }
    throw e;
  }
}

async function listBookingReviews({ bookingId, auth, req }) {
  const { userId, role } = getAuthOrThrow(auth);
  const id = parseId(bookingId, 'bookingId');

  const where =
    role === 'admin'
      ? { id }
      : role === 'customer'
        ? { id, user_id: userId }
        : { id, assigned_driver_user_id: userId };

  const booking = await db.Booking.findOne({ where, attributes: ['id'] });
  if (!booking) throw new HttpError(404, 'Booking not found');

  const rows = await db.Review.findAll({
    where: { booking_id: booking.id },
    include: [{ model: db.ReviewImage, as: 'images', required: false, attributes: ['id', 'image_url', 'created_at'] }],
    order: [['created_at', 'ASC'], ['id', 'ASC']]
  });

  return rows.map((r) => {
    const plain = r.get({ plain: true });
    const imgs = Array.isArray(plain.images) ? plain.images : [];
    return {
      ...plain,
      images: imgs.map((i) => i.image_url)
    };
  });
}

function formatReviewForPublicResponse(review, req) {
  if (!review) return null;
  const plain = review.get ? review.get({ plain: true }) : review;
  const imgs = Array.isArray(plain.images) ? plain.images : [];
  return {
    id: plain.id,
    booking_id: plain.booking_id,
    rating: plain.rating,
    message: plain.message ?? null,
    is_satisfied: plain.is_satisfied ?? null,
    reviewer_role: plain.reviewer_role,
    reviewee_role: plain.reviewee_role,
    created_at: plain.created_at,
    images: imgs.map((i) => ensureAbsoluteUrl(req, i.image_url)),
    admin_response: plain.admin_response ?? null,
    admin_responded_at: plain.admin_responded_at ?? null,
  };
}

async function getCustomerDriverReviewForBooking({ bookingId, customerUserId, req }) {
  const bid = parseId(bookingId, 'bookingId');
  const uid = Number(customerUserId);
  if (!uid) return null;

  const row = await db.Review.findOne({
    where: {
      booking_id: bid,
      reviewer_user_id: uid,
      reviewer_role: 'customer',
      reviewee_role: 'driver'
    },
    include: [{ model: db.ReviewImage, as: 'images', required: false, attributes: ['id', 'image_url', 'created_at'] }]
  });

  return formatReviewForPublicResponse(row, req);
}

function canCustomerReviewDriver({ status, assignedDriverUserId, driverReview }) {
  return String(status) === 'completed' && !!assignedDriverUserId && !driverReview;
}

async function getRatingSummariesByUserIds({ userIds }) {
  const ids = (userIds || []).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return new Map();

  const rows = await db.Review.findAll({
    where: { reviewee_user_id: { [Op.in]: ids } },
    attributes: [
      'reviewee_user_id',
      [fn('AVG', col('rating')), 'avg_rating'],
      [fn('COUNT', col('id')), 'review_count']
    ],
    group: ['reviewee_user_id']
  });

  const out = new Map();
  for (const r of rows) {
    const plain = r.get({ plain: true });
    const uid = Number(plain.reviewee_user_id);
    out.set(uid, {
      avg_rating: plain.avg_rating === null ? null : Number(plain.avg_rating),
      review_count: Number(plain.review_count || 0)
    });
  }
  return out;
}

/** Average rating for list cards; null when the user has no published reviews. */
function formatPublicAvgRating(ratingSummary) {
  const reviewCount = Number(ratingSummary?.review_count || 0);
  if (!reviewCount || ratingSummary?.avg_rating == null) return null;
  return Number(Number(ratingSummary.avg_rating).toFixed(1));
}

module.exports = {
  createBookingReview,
  listBookingReviews,
  getRatingSummariesByUserIds,
  formatReviewForPublicResponse,
  getCustomerDriverReviewForBooking,
  canCustomerReviewDriver,
  formatPublicAvgRating,
};

