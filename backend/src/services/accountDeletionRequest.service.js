'use strict';

const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sendEmail } = require('./email.service');
const { generateEmailTemplate } = require('../../utils/emailTemplate');

const BLOCKING_BOOKING_STATUSES = ['pending', 'pending_payment', 'confirmed', 'assigned', 'in_progress'];
const OPEN_REQUEST_STATUSES = ['otp_pending', 'pending'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanString(value, max = 1000) {
  const text = String(value || '').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function serializeRequest(row) {
  if (!row) return null;
  const json = row.toJSON ? row.toJSON() : row;
  delete json.otp_code;
  return json;
}

function serializeRequestSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    source: row.source,
    requested_at: row.created_at || row.createdAt || null,
    processed_at: row.processed_at || row.processedAt || null,
    admin_note: row.admin_note || null
  };
}

function userSnapshot(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    country_code: user.country_code,
    role: user.role,
    status: user.status
  };
}

async function findBlockingBooking(user) {
  if (!user?.id) return null;

  const role = String(user.role || '').toLowerCase();
  const participantWhere =
    role === 'driver'
      ? { assigned_driver_user_id: user.id }
      : { user_id: user.id };

  return db.Booking.findOne({
    where: {
      ...participantWhere,
      status: { [Op.in]: BLOCKING_BOOKING_STATUSES }
    },
    attributes: ['id', 'booking_code', 'status', 'scheduled_at', 'service_datetime'],
    order: [['created_at', 'DESC']]
  });
}

async function assertNoBlockingBooking(user) {
  const booking = await findBlockingBooking(user);
  if (!booking) return;

  throw new HttpError(409, 'Account deletion cannot be requested while you have a pending or in-progress booking.', {
    booking: {
      id: booking.id,
      booking_code: booking.booking_code,
      status: booking.status
    }
  });
}

function assertUserCanRequestDeletion(user) {
  const status = String(user?.status || 'active').toLowerCase();
  if (status !== 'active') {
    throw new HttpError(409, 'This account is not active and cannot submit another deletion request.');
  }
}

async function findOpenRequestForUserOrEmail({ userId = null, email }) {
  const conditions = [];
  if (userId) conditions.push({ user_id: userId });
  if (email) conditions.push({ email });
  if (!conditions.length) return null;

  return db.AccountDeletionRequest.findOne({
    where: {
      status: { [Op.in]: OPEN_REQUEST_STATUSES },
      [Op.or]: conditions
    },
    order: [['created_at', 'DESC']]
  });
}

async function getOpenDeletionRequestForUser(userId) {
  const uid = Number(userId);
  if (!uid) return null;
  const request = await db.AccountDeletionRequest.findOne({
    where: {
      user_id: uid,
      status: { [Op.in]: OPEN_REQUEST_STATUSES }
    },
    order: [['created_at', 'DESC']]
  });
  return serializeRequestSummary(request);
}

async function createAuthenticatedRequest({ auth, reason }) {
  const uid = Number(auth?.userId);
  if (!uid) throw new HttpError(401, 'Unauthorized');

  const safeReason = cleanString(reason, 4000);
  if (!safeReason) throw new HttpError(400, 'reason is required');

  const user = await db.User.findByPk(uid);
  if (!user) throw new HttpError(404, 'User not found');
  if (!['customer', 'driver'].includes(String(user.role))) {
    throw new HttpError(403, 'Only customer and service provider accounts can request deletion');
  }
  assertUserCanRequestDeletion(user);
  await assertNoBlockingBooking(user);

  const email = normalizeEmail(user.email);
  if (!email) throw new HttpError(400, 'Your account does not have an email address');

  const existing = await findOpenRequestForUserOrEmail({ userId: user.id, email });
  if (existing) {
    throw new HttpError(409, 'An account deletion request is already pending for this account.');
  }

  const request = await db.AccountDeletionRequest.create({
    user_id: user.id,
    role: user.role,
    name: user.name,
    email,
    phone: user.phone,
    reason: safeReason,
    source: 'app',
    status: 'pending',
    otp_verified_at: new Date(),
    user_snapshot: userSnapshot(user)
  });

  return { already_pending: false, request: serializeRequest(request) };
}

async function sendPublicDeletionOtp({ name, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new HttpError(400, 'email is required');

  const user = await db.User.findOne({ where: { email: normalizedEmail } });
  if (user) {
    assertUserCanRequestDeletion(user);
    await assertNoBlockingBooking(user);
  }

  const existing = await findOpenRequestForUserOrEmail({
    userId: user?.id || null,
    email: normalizedEmail
  });
  if (existing?.status === 'pending') {
    throw new HttpError(409, 'An account deletion request is already pending for this email.');
  }

  const otp = generateOtp();
  const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  const otpExpiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
  const safeName = cleanString(name, 160) || user?.name || null;

  const request = existing || await db.AccountDeletionRequest.create({
    user_id: user?.id || null,
    role: user?.role || null,
    name: safeName,
    email: normalizedEmail,
    phone: user?.phone || null,
    source: 'public',
    status: 'otp_pending',
    user_snapshot: userSnapshot(user)
  });

  await request.update({
    user_id: user?.id || request.user_id,
    role: user?.role || request.role,
    name: safeName,
    email: normalizedEmail,
    phone: user?.phone || request.phone,
    source: 'public',
    status: 'otp_pending',
    otp_code: otp,
    otp_expiry: otpExpiry,
    otp_verified_at: null,
    user_snapshot: userSnapshot(user)
  });

  const html = generateEmailTemplate({
    title: 'Confirm account deletion request',
    message: 'Enter the verification code below to continue with your account deletion request.',
    code: otp,
    footer: `If you did not request account deletion, please ignore this email. The code expires in ${otpExpiryMinutes} minutes.`,
    preheader: `Your account deletion verification code is ${otp}.`
  });

  await sendEmail({
    to: normalizedEmail,
    subject: 'Confirm your account deletion request',
    text: `Your account deletion verification code is ${otp}. It expires in ${otpExpiryMinutes} minutes.`,
    html
  });

  return { email: normalizedEmail, expires_at: otpExpiry };
}

async function submitPublicDeletionRequest({ name, email, otp, reason }) {
  const normalizedEmail = normalizeEmail(email);
  const safeReason = cleanString(reason, 4000) || null; // reason is optional for public web submissions
  const safeOtp = cleanString(otp, 10);
  if (!normalizedEmail) throw new HttpError(400, 'email is required');
  if (!safeOtp) throw new HttpError(400, 'otp is required');

  const request = await db.AccountDeletionRequest.findOne({
    where: {
      email: normalizedEmail,
      status: 'otp_pending'
    },
    order: [['updated_at', 'DESC']]
  });
  if (!request) throw new HttpError(400, 'Please send OTP before submitting the deletion request.');
  if (!request.otp_expiry || new Date(request.otp_expiry).getTime() < Date.now()) {
    throw new HttpError(400, 'OTP has expired. Please request a new OTP.');
  }
  if (String(request.otp_code || '') !== safeOtp) {
    throw new HttpError(400, 'Invalid OTP');
  }

  const user = request.user_id
    ? await db.User.findByPk(request.user_id)
    : await db.User.findOne({ where: { email: normalizedEmail } });
  if (user) {
    assertUserCanRequestDeletion(user);
    await assertNoBlockingBooking(user);
  }

  await request.update({
    user_id: user?.id || request.user_id,
    role: user?.role || request.role,
    name: cleanString(name, 160) || request.name || user?.name || null,
    phone: user?.phone || request.phone,
    reason: safeReason,
    status: 'pending',
    otp_code: null,
    otp_expiry: null,
    otp_verified_at: new Date(),
    user_snapshot: userSnapshot(user)
  });

  return { request: serializeRequest(request) };
}

async function listAdminDeletionRequests(query = {}) {
  const pageNum = Math.max(1, parseInt(query.page || 1, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(query.limit || 10, 10)));
  const offset = (pageNum - 1) * limitNum;
  const where = {};

  if (query.status && ['otp_pending', 'pending', 'approved', 'rejected'].includes(String(query.status))) {
    where.status = String(query.status);
  }

  if (query.role && ['customer', 'driver'].includes(String(query.role).toLowerCase())) {
    where.role = String(query.role).toLowerCase();
  }

  if (query.source && ['app', 'public'].includes(String(query.source).toLowerCase())) {
    where.source = String(query.source).toLowerCase();
  }

  // Date range filter on created_at
  const dateFrom = query.date_from ? new Date(query.date_from) : null;
  const dateTo   = query.date_to   ? new Date(query.date_to)   : null;
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom && !isNaN(dateFrom)) where.created_at[Op.gte] = dateFrom;
    if (dateTo   && !isNaN(dateTo))   where.created_at[Op.lte] = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const search = cleanString(query.search, 255);
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } }
    ];
  }

  const { rows, count } = await db.AccountDeletionRequest.findAndCountAll({
    where,
    include: [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'role', 'status'] },
      { model: db.User, as: 'processor', attributes: ['id', 'name', 'email'] }
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset
  });

  return {
    requests: rows.map(serializeRequest),
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(count / limitNum)
    }
  };
}

async function getAdminDeletionRequestStats() {
  const rows = await db.AccountDeletionRequest.findAll({
    attributes: [
      'status',
      [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });

  const map = {};
  for (const row of rows) map[row.status] = parseInt(row.count, 10);

  return {
    total:       (map.otp_pending || 0) + (map.pending || 0) + (map.approved || 0) + (map.rejected || 0),
    otp_pending: map.otp_pending || 0,
    pending:     map.pending     || 0,
    approved:    map.approved    || 0,
    rejected:    map.rejected    || 0,
  };
}

async function approveDeletionRequest({ requestId, adminId, adminNote }) {
  const request = await db.AccountDeletionRequest.findByPk(requestId);
  if (!request) throw new HttpError(404, 'Account deletion request not found');
  if (request.status !== 'pending') throw new HttpError(400, 'Only pending requests can be approved');

  const user = request.user_id ? await db.User.findByPk(request.user_id) : null;
  if (user) {
    await assertNoBlockingBooking(user);
    await user.update({
      status: 'suspended',
      suspended_reason: cleanString(adminNote, 1000) || 'Account deletion request approved',
      suspended_at: new Date(),
      deactivated_at: null,
      token_version: (user.token_version || 0) + 1
    });
  }

  await request.update({
    status: 'approved',
    processed_by: adminId,
    processed_at: new Date(),
    admin_note: cleanString(adminNote, 4000) || null
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'account_deletion_request_approved',
    entity_type: 'account_deletion_request',
    entity_id: request.id,
    details: {
      request_id: request.id,
      user_id: request.user_id,
      email: request.email,
      suspended_user: Boolean(user)
    }
  });

  return { request: serializeRequest(request) };
}

async function rejectDeletionRequest({ requestId, adminId, adminNote }) {
  const note = cleanString(adminNote, 4000);
  if (!note) throw new HttpError(400, 'admin_note is required');

  const request = await db.AccountDeletionRequest.findByPk(requestId);
  if (!request) throw new HttpError(404, 'Account deletion request not found');
  if (request.status !== 'pending') throw new HttpError(400, 'Only pending requests can be rejected');

  await request.update({
    status: 'rejected',
    processed_by: adminId,
    processed_at: new Date(),
    admin_note: note
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'account_deletion_request_rejected',
    entity_type: 'account_deletion_request',
    entity_id: request.id,
    details: {
      request_id: request.id,
      user_id: request.user_id,
      email: request.email,
      admin_note: note
    }
  });

  return { request: serializeRequest(request) };
}

module.exports = {
  BLOCKING_BOOKING_STATUSES,
  createAuthenticatedRequest,
  sendPublicDeletionOtp,
  submitPublicDeletionRequest,
  getOpenDeletionRequestForUser,
  listAdminDeletionRequests,
  getAdminDeletionRequestStats,
  approveDeletionRequest,
  rejectDeletionRequest
};
