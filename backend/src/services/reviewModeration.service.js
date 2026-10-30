const { Op, fn, col } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sanitizePlainText } = require('../utils/userContentSanitize');
const { sendEmail } = require('./email.service');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');
const { logger } = require('../config/logger');

async function listReviews(params = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    moderation_status,
    min_rating,
    max_rating,
    sort = 'created_at',
    order = 'desc',
    booking_code,
    flagged_only,
    pending_only,
    offensive_only,
    user_type,
    date_from,
    date_to,
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const andParts = [];

  if (moderation_status) {
    andParts.push({ moderation_status });
  }
  if (pending_only === 'true' || pending_only === true) {
    andParts.push({ moderation_status: 'pending' });
  }
  if (flagged_only === 'true' || flagged_only === true) {
    andParts.push({ moderation_status: 'flagged' });
  }
  if (offensive_only === 'true' || offensive_only === true) {
    andParts.push({
      [Op.or]: [{ flags_count: { [Op.gt]: 0 } }, { moderation_status: 'flagged' }],
    });
  }

  if (min_rating) {
    andParts.push({ rating: { [Op.gte]: parseInt(min_rating, 10) } });
  }
  if (max_rating) {
    andParts.push({ rating: { [Op.lte]: parseInt(max_rating, 10) } });
  }

  if (user_type === 'customer' || user_type === 'driver') {
    andParts.push({ reviewer_role: user_type });
  }

  if (date_from || date_to) {
    andParts.push({
      created_at: {
        ...(date_from ? { [Op.gte]: new Date(date_from) } : {}),
        ...(date_to ? { [Op.lte]: new Date(date_to) } : {}),
      },
    });
  }

  if (search) {
    andParts.push({
      [Op.or]: [
        { message: { [Op.like]: `%${search}%` } },
        { '$reviewer.name$': { [Op.like]: `%${search}%` } },
        { '$reviewee.name$': { [Op.like]: `%${search}%` } },
        { '$booking.booking_code$': { [Op.like]: `%${search}%` } },
      ],
    });
  }

  const bookingIncludeWhere = {};
  if (booking_code) {
    bookingIncludeWhere.booking_code = { [Op.like]: `%${String(booking_code).trim()}%` };
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};

  const validSorts = ['created_at', 'rating', 'moderation_status', 'moderated_at', 'flags_count'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';

  const { count, rows } = await db.Review.findAndCountAll({
    where,
    include: [
      { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email', 'role'] },
      { model: db.User, as: 'reviewee', attributes: ['id', 'name', 'email', 'role'] },
      {
        model: db.Booking,
        as: 'booking',
        attributes: ['id', 'booking_code'],
        required: Object.keys(bookingIncludeWhere).length > 0,
        where: Object.keys(bookingIncludeWhere).length ? bookingIncludeWhere : undefined,
      },
      { model: db.ReviewImage, as: 'images' },
      { model: db.User, as: 'moderator', attributes: ['id', 'name'] },
    ],
    order: [[sortField, order === 'asc' ? 'ASC' : 'DESC']],
    limit: limitNum,
    offset,
    distinct: true,
    subQuery: false,
  });

  return {
    reviews: rows,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(count / limitNum),
    },
  };
}

async function getReviewDetail(reviewId) {
  const review = await db.Review.findByPk(reviewId, {
    include: [
      { model: db.User, as: 'reviewer', attributes: { exclude: ['password', 'otp_code'] } },
      { model: db.User, as: 'reviewee', attributes: { exclude: ['password', 'otp_code'] } },
      {
        model: db.Booking,
        as: 'booking',
        include: [
          { model: db.Package, as: 'package', attributes: ['id', 'name'], required: false },
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
          { model: db.User, as: 'assigned_driver', attributes: ['id', 'name', 'email', 'phone'], required: false },
        ],
      },
      { model: db.ReviewImage, as: 'images' },
      { model: db.User, as: 'moderator', attributes: ['id', 'name', 'email'] },
    ],
  });
  if (!review) throw new HttpError(404, 'Review not found');

  const history = await db.AdminAuditLog.findAll({
    where: { entity_type: 'review', entity_id: reviewId },
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
    order: [['created_at', 'ASC']],
  });

  return {
    review: review.get({ plain: true }),
    moderation_history: history.map((h) => h.get({ plain: true })),
  };
}

async function notifyReviewAuthorOnRemoval(review, reason) {
  const reviewer = await db.User.findByPk(review.reviewer_user_id, { attributes: ['id', 'email', 'name'] });
  if (!reviewer?.email) return;
  const text = [
    `Hello ${reviewer.name || ''},`,
    '',
    'Your review was removed after moderation.',
    reason ? `Reason: ${reason}` : '',
    '',
    'If you believe this was a mistake, please contact support.',
  ]
    .filter(Boolean)
    .join('\n');
  await sendEmail({
    to: reviewer.email,
    subject: 'Your review was removed',
    text,
  }).catch(() => {});

  if (isOneSignalConfigured()) {
    await sendPushToUser(reviewer.id, {
      title: 'Review removed',
      body: 'Your review was removed after moderation.',
      data: { kind: 'REVIEW_REMOVED', review_id: String(review.id) },
      idempotencyKey: `review_removed:${review.id}`,
    }).catch((e) => logger.warn('review_removed_push_failed', { message: e?.message }));
  }
}

async function updateModerationStatus(reviewId, { status, reason, moderation_notes, adminId, ipAddress }) {
  const review = await db.Review.findByPk(reviewId);
  if (!review) throw new HttpError(404, 'Review not found');

  const validStatuses = ['pending', 'approved', 'hidden', 'removed', 'flagged'];
  if (!validStatuses.includes(status)) {
    throw new HttpError(400, `Status must be one of: ${validStatuses.join(', ')}`);
  }

  const previousStatus = review.moderation_status;

  await review.update({
    moderation_status: status,
    moderated_by: adminId,
    moderation_reason: reason || null,
    moderation_notes: moderation_notes != null ? String(moderation_notes).slice(0, 5000) : review.moderation_notes,
    moderated_at: new Date(),
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: `review_${status}`,
    entity_type: 'review',
    entity_id: reviewId,
    details: {
      previous_status: previousStatus,
      new_status: status,
      reason,
      moderation_notes,
    },
    ip_address: ipAddress,
  });

  if (status === 'removed') {
    await notifyReviewAuthorOnRemoval(review, reason || moderation_notes).catch(() => {});
  }

  return review.reload({
    include: [
      { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'reviewee', attributes: ['id', 'name', 'email'] },
      { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      { model: db.User, as: 'moderator', attributes: ['id', 'name'] },
    ],
  });
}

async function editReviewContent(reviewId, { message, adminId, ipAddress }) {
  const review = await db.Review.findByPk(reviewId);
  if (!review) throw new HttpError(404, 'Review not found');

  const safe = sanitizePlainText(message, { maxLength: 2000 });
  const originalMessage = review.original_message || review.message;

  await review.update({
    message: safe,
    original_message: originalMessage,
    moderated_by: adminId,
    moderated_at: new Date(),
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'review_content_edited',
    entity_type: 'review',
    entity_id: reviewId,
    details: {
      original_message: originalMessage,
      new_message: safe,
    },
    ip_address: ipAddress,
  });

  return review;
}

async function respondToReview(reviewId, { response, adminId, ipAddress }) {
  const review = await db.Review.findByPk(reviewId);
  if (!review) throw new HttpError(404, 'Review not found');

  const safe = sanitizePlainText(response, { maxLength: 2000 });
  if (!safe || !safe.trim()) throw new HttpError(400, 'Response text is required');

  await review.update({
    admin_response: safe.trim(),
    admin_responded_at: new Date(),
    admin_responder_id: adminId,
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'review_responded',
    entity_type: 'review',
    entity_id: reviewId,
    details: { response: safe.trim() },
    ip_address: ipAddress,
  });

  return review.reload({
    include: [
      { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'reviewee', attributes: ['id', 'name', 'email'] },
      { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      { model: db.User, as: 'moderator', attributes: ['id', 'name'] },
    ],
  });
}

async function deleteAdminResponse(reviewId, { adminId, ipAddress }) {
  const review = await db.Review.findByPk(reviewId);
  if (!review) throw new HttpError(404, 'Review not found');
  if (!review.admin_response) throw new HttpError(400, 'No admin response to delete');

  await review.update({
    admin_response: null,
    admin_responded_at: null,
    admin_responder_id: null,
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'review_response_deleted',
    entity_type: 'review',
    entity_id: reviewId,
    details: {},
    ip_address: ipAddress,
  });

  return review.reload({
    include: [
      { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'reviewee', attributes: ['id', 'name', 'email'] },
      { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      { model: db.User, as: 'moderator', attributes: ['id', 'name'] },
    ],
  });
}

async function getReviewStats() {
  const [total, pending, approved, hidden, removed, flagged, avgRating] = await Promise.all([
    db.Review.count(),
    db.Review.count({ where: { moderation_status: 'pending' } }),
    db.Review.count({ where: { moderation_status: 'approved' } }),
    db.Review.count({ where: { moderation_status: 'hidden' } }),
    db.Review.count({ where: { moderation_status: 'removed' } }),
    db.Review.count({ where: { moderation_status: 'flagged' } }),
    db.Review.findOne({
      attributes: [[fn('AVG', col('rating')), 'avg']],
      raw: true,
    }),
  ]);

  return {
    total,
    pending,
    approved,
    hidden,
    removed,
    flagged,
    avg_rating: avgRating?.avg ? parseFloat(Number(avgRating.avg).toFixed(1)) : 0,
  };
}

module.exports = {
  listReviews,
  getReviewDetail,
  updateModerationStatus,
  editReviewContent,
  respondToReview,
  deleteAdminResponse,
  getReviewStats,
};
