const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { notifyDriverProfileApprovalStatus } = require('../../services/driverProfileApprovalNotify.service');
const { assignSystemPassword, setUserPassword } = require('../../services/userPassword.service');
const { sendPasswordUpdatedEmail } = require('../../services/lifecycleEmail.service');
const { toAdminProviderJson, mapAdminPlainList, toAdminPlainJson } = require('../../utils/adminJson');
const { buildDriverEarningSummary } = require('../../utils/bookingDriverEarning');
const { generateProviderServiceRecordPdf, resolveServiceLocationAddress } = require('../../services/providerServiceRecordPdf.service');
const {
  saveOriginalImageFile,
  ensureAbsoluteUrl,
  publicPathToDiskPath
} = require('../../utils/fileUpload');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function logAudit(adminId, actionType, entityType, entityId, details, ip) {
  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: ip,
  });
}

function mapProviderProfileUniqueConstraintError(err) {
  if (String(err?.name || '') !== 'SequelizeUniqueConstraintError') return null;

  const fields = err?.fields || {};
  const errorPaths = Array.isArray(err?.errors) ? err.errors.map((item) => item.path) : [];
  if (fields.phone || fields.phone_2 || errorPaths.includes('phone')) {
    return new HttpError(409, 'Phone number is already in use by another account');
  }
  if (fields.email || fields.email_2 || errorPaths.includes('email')) {
    return new HttpError(409, 'Email is already in use by another account');
  }

  return new HttpError(409, 'An account already uses one of these contact details');
}

async function listProviders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      approval_status,
      insurance_verified,
      sort = 'created_at',
      order = 'desc',
      min_services,
      max_services,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const userWhere = { role: 'driver' };
    const profileWhere = {};

    if (status) {
      userWhere.status = status;
    }

    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (approval_status) {
      profileWhere.approval_status = approval_status;
    }

    if (insurance_verified !== undefined && insurance_verified !== '') {
      profileWhere.insurance_verified = insurance_verified === 'true';
    }

    const validSortFields = ['created_at', 'name', 'email', 'status'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const { count, rows } = await db.User.findAndCountAll({
      where: userWhere,
      attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry'] },
      include: [
        {
          model: db.DriverProfile,
          as: 'driver_profile',
          where: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
          required: Object.keys(profileWhere).length > 0,
        },
      ],
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const providerIds = rows.map((u) => u.id);
    let bookingCounts = {};
    let earningsMap = {};
    let ratingsMap = {};

    if (providerIds.length > 0) {
      const bookingStats = await db.Booking.findAll({
        where: { assigned_driver_user_id: { [Op.in]: providerIds }, status: { [Op.ne]: 'draft' } },
        attributes: [
          'assigned_driver_user_id',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total_services'],
          [db.sequelize.fn('SUM', db.sequelize.literal("CASE WHEN status = 'completed' THEN COALESCE(total_price, 0) ELSE 0 END")), 'total_earnings'],
        ],
        group: ['assigned_driver_user_id'],
        raw: true,
      });

      for (const stat of bookingStats) {
        bookingCounts[stat.assigned_driver_user_id] = parseInt(stat.total_services) || 0;
        earningsMap[stat.assigned_driver_user_id] = parseFloat(stat.total_earnings) || 0;
      }

      const ratingStats = await db.Review.findAll({
        where: { reviewee_user_id: { [Op.in]: providerIds } },
        attributes: [
          'reviewee_user_id',
          [db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avg_rating'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total_reviews'],
        ],
        group: ['reviewee_user_id'],
        raw: true,
      });

      for (const stat of ratingStats) {
        ratingsMap[stat.reviewee_user_id] = {
          avg_rating: parseFloat(stat.avg_rating).toFixed(1),
          total_reviews: parseInt(stat.total_reviews) || 0,
        };
      }
    }

    let providers = rows.map((user) => ({
      ...toAdminProviderJson(user),
      total_services: bookingCounts[user.id] || 0,
      total_earnings: (earningsMap[user.id] || 0).toFixed(2),
      avg_rating: ratingsMap[user.id]?.avg_rating || null,
      total_reviews: ratingsMap[user.id]?.total_reviews || 0,
    }));

    if (min_services || max_services) {
      const minS = parseInt(min_services) || 0;
      const maxS = parseInt(max_services) || Infinity;
      providers = providers.filter(
        (p) => p.total_services >= minS && p.total_services <= maxS
      );
    }

    return res.success('Providers fetched', {
      providers,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function enrichProviderBookingForAdmin(booking) {
  const plain = toAdminPlainJson(booking);
  let provider_earning = null;
  try {
    const financeTxn = await db.Transaction.findOne({
      where: { booking_id: plain.id },
      attributes: ['provider_earning'],
      order: [['id', 'DESC']],
    });
    const summary = await buildDriverEarningSummary({
      booking: typeof booking.get === 'function' ? booking.get({ plain: true }) : plain,
      financeProviderEarning: financeTxn?.provider_earning,
    });
    provider_earning = summary.amount;
  } catch (_) {
    provider_earning = null;
  }

  return {
    ...plain,
    provider_earning,
    pickup_address: plain.address || null,
    service_location_address: resolveServiceLocationAddress(plain),
  };
}

async function getProvider(req, res, next) {
  try {
    const { id } = req.params;

    const user = await db.User.findOne({
      where: { id, role: 'driver' },
      attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry'] },
      include: [
        { model: db.DriverProfile, as: 'driver_profile' },
        { model: db.Vehicle, as: 'vehicles', include: [{ model: db.VehicleImage, as: 'images' }] },
      ],
    });
    if (!user) throw new HttpError(404, 'Provider not found');

    const bookings = await db.Booking.findAll({
      where: { assigned_driver_user_id: id, status: { [Op.ne]: 'draft' } },
      attributes: {
        include: [
          'service_started_at',
          'service_completed_at',
          'service_duration_minutes',
          'address',
          'service_address',
          'ev_charging_address',
          'service_location_name',
        ],
      },
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'first_name', 'last_name'] },
        { model: db.Vehicle, as: 'vehicle', attributes: ['id', 'make', 'model', 'license_plate', 'color'] },
        { model: db.Package, as: 'package', attributes: ['id', 'name'], include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }] },
      ],
      order: [['created_at', 'DESC']],
    });

    const enrichedBookings = await Promise.all(bookings.map((b) => enrichProviderBookingForAdmin(b)));

    const reviews = await db.Review.findAll({
      where: { reviewee_user_id: id },
      include: [
        { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
        { model: db.ReviewImage, as: 'images' },
      ],
      order: [['created_at', 'DESC']],
    });

    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const totalEarnings = completedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);
    const statusBreakdown = {};
    for (const b of bookings) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
    }
    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

    const stats = {
      total_bookings: bookings.length,
      status_breakdown: statusBreakdown,
      completed_bookings: completedBookings.length,
      total_earnings: totalEarnings.toFixed(2),
      total_reviews: reviews.length,
      avg_rating: avgRating,
      completion_rate: bookings.length
        ? ((completedBookings.length / bookings.length) * 100).toFixed(1)
        : '0.0',
    };

    const auditLogs = await db.AdminAuditLog.findAll({
      where: { entity_type: 'user', entity_id: id },
      include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    return res.success('Provider fetched', {
      user: toAdminProviderJson(user),
      stats,
      bookings: enrichedBookings,
      reviews: mapAdminPlainList(reviews),
      audit_logs: mapAdminPlainList(auditLogs),
    });
  } catch (err) {
    return next(err);
  }
}

async function downloadProviderServiceRecord(req, res, next) {
  try {
    const providerId = Number(req.params.id);
    const bookingId = Number(req.params.bookingId);
    if (!providerId || !bookingId) throw new HttpError(400, 'Invalid provider or booking id');

    const user = await db.User.findOne({
      where: { id: providerId, role: 'driver' },
      attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry'] },
    });
    if (!user) throw new HttpError(404, 'Provider not found');

    const booking = await db.Booking.findOne({
      where: { id: bookingId, assigned_driver_user_id: providerId },
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'first_name', 'last_name', 'email'],
        },
        {
          model: db.Package,
          as: 'package',
          attributes: ['id', 'name'],
          include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
        },
      ],
    });
    if (!booking) throw new HttpError(404, 'Booking not found for this provider');

    const financeTxn = await db.Transaction.findOne({
      where: { booking_id: bookingId },
      attributes: ['provider_earning'],
      order: [['id', 'DESC']],
    });

    const driverEarning = await buildDriverEarningSummary({
      booking: booking.get({ plain: true }),
      financeProviderEarning: financeTxn?.provider_earning,
    });

    const pdf = await generateProviderServiceRecordPdf({
      booking: booking.get({ plain: true }),
      provider: user.get({ plain: true }),
      customer: booking.user?.get ? booking.user.get({ plain: true }) : booking.user,
      providerEarning: driverEarning.amount,
    });

    const fileLabel = booking.booking_code || bookingId;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carcomfort-service-record-${fileLabel}.pdf"`
    );
    return res.send(pdf);
  } catch (err) {
    return next(err);
  }
}

async function updateProviderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.auth.userId;

    if (!['active', 'suspended', 'deactivated'].includes(status)) {
      throw new HttpError(400, 'status must be one of: active, suspended, deactivated');
    }

    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const previousStatus = user.status;
    const updateData = { status };

    if (status === 'suspended') {
      updateData.suspended_reason = reason || null;
      updateData.suspended_at = new Date();
      updateData.deactivated_at = null;
    } else if (status === 'deactivated') {
      updateData.deactivated_at = new Date();
      updateData.suspended_reason = null;
      updateData.suspended_at = null;
    } else {
      updateData.suspended_reason = null;
      updateData.suspended_at = null;
      updateData.deactivated_at = null;
    }

    if (status === 'suspended' || status === 'deactivated') {
      updateData.token_version = (user.token_version || 0) + 1;
    }

    await user.update(updateData);

    await logAudit(
      adminId,
      `provider_status_${status}`,
      'user',
      user.id,
      { previous_status: previousStatus, new_status: status, reason },
      getClientIp(req)
    );

    return res.success(`Provider ${status} successfully`, {
      user: { id: user.id, status: user.status },
    });
  } catch (err) {
    return next(err);
  }
}

async function approveProvider(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;

    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const profile = await db.DriverProfile.findOne({ where: { user_id: id } });
    if (!profile) throw new HttpError(404, 'Provider profile not found');

    await profile.update({
      approval_status: 'approved',
      approval_reason: null,
      approved_at: new Date(),
      approved_by: adminId,
      rejected_at: null,
    });

    await logAudit(
      adminId,
      'provider_approved',
      'user',
      user.id,
      { approval_status: 'approved' },
      getClientIp(req)
    );

    await notifyDriverProfileApprovalStatus({
      driverUserId: user.id,
      status: 'approved',
      profile,
    });

    return res.success('Provider approved', {
      driver_profile: {
        user_id: profile.user_id,
        approval_status: profile.approval_status,
        approved_at: profile.approved_at,
        approved_by: profile.approved_by,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function rejectProvider(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.auth.userId;

    if (!reason || !reason.trim()) {
      throw new HttpError(400, 'reason is required');
    }

    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const profile = await db.DriverProfile.findOne({ where: { user_id: id } });
    if (!profile) throw new HttpError(404, 'Provider profile not found');

    await profile.update({
      approval_status: 'rejected',
      approval_reason: reason.trim(),
      approved_at: null,
      approved_by: null,
      rejected_at: new Date(),
    });

    await logAudit(
      adminId,
      'provider_rejected',
      'user',
      user.id,
      { approval_status: 'rejected', reason: reason.trim() },
      getClientIp(req)
    );

    await notifyDriverProfileApprovalStatus({
      driverUserId: user.id,
      status: 'rejected',
      reason: reason.trim(),
      profile,
    });

    return res.success('Provider rejected', {
      driver_profile: {
        user_id: profile.user_id,
        approval_status: profile.approval_status,
        approval_reason: profile.approval_reason,
        rejected_at: profile.rejected_at,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateInsuranceStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { insurance_verified } = req.body;
    const adminId = req.auth.userId;

    if (typeof insurance_verified !== 'boolean') {
      throw new HttpError(400, 'insurance_verified must be a boolean');
    }

    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const profile = await db.DriverProfile.findOne({ where: { user_id: id } });
    if (!profile) throw new HttpError(404, 'Provider profile not found');

    const previousValue = profile.insurance_verified;
    await profile.update({ insurance_verified });

    await logAudit(
      adminId,
      'provider_insurance_status_change',
      'user',
      user.id,
      { previous: previousValue, new: insurance_verified },
      getClientIp(req)
    );

    return res.success('Insurance status updated', {
      driver_profile: {
        user_id: profile.user_id,
        insurance_verified: profile.insurance_verified,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function resetProviderPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password, notify_email } = req.body || {};
    const adminId = req.auth.userId;

    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const customPassword = typeof password === 'string' ? password.trim() : '';
    const tempPassword = customPassword
      ? await setUserPassword(user, customPassword)
      : await assignSystemPassword(user);

    let email_sent = false;
    if (notify_email && user.email) {
      const result = await sendPasswordUpdatedEmail({ user, plainPassword: tempPassword });
      email_sent = Boolean(result?.sent);
    }

    await logAudit(
      adminId,
      'provider_password_reset',
      'user',
      user.id,
      {
        method: customPassword ? 'custom_password' : 'generated_password',
        auth_type: user.auth_type,
        notify_email: Boolean(notify_email),
        email_sent,
      },
      getClientIp(req)
    );

    return res.success('Password reset successfully', {
      temp_password: tempPassword,
      email_sent,
      message: email_sent
        ? 'Password updated and emailed to the provider. All sessions were invalidated.'
        : 'Share this password securely with the provider. All sessions were invalidated.',
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin: upload / replace a service provider's profile photo.
 * Accepts multipart/form-data with field name `profile_photo`.
 */
async function uploadProviderProfilePhoto(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) throw new HttpError(400, 'Invalid provider id');

    if (!req.file) throw new HttpError(400, 'profile_photo file is required');

    const provider = await db.User.findByPk(id, {
      attributes: ['id', 'role'],
      include: [{ model: db.DriverProfile, as: 'driver_profile', attributes: ['id', 'user_id', 'profile_picture'] }],
    });
    if (!provider || provider.role !== 'driver') throw new HttpError(404, 'Service provider not found');

    const saved = await saveOriginalImageFile({
      buffer: req.file.buffer,
      uploadDir: 'driver/profile-pictures',
      req,
      fileBaseName: req.file.originalname || 'profile',
    });

    let profile = provider.driver_profile;
    if (!profile) {
      profile = await db.DriverProfile.create({ user_id: id, profile_picture: saved.publicPath });
    } else {
      await profile.update({ profile_picture: saved.publicPath });
    }

    await logAudit(
      req.auth.userId,
      'provider_profile_photo_updated',
      'user',
      id,
      { file_name: req.file.originalname || 'profile photo' },
      getClientIp(req)
    );

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully.',
      data: {
        user_id: id,
        profile_picture: ensureAbsoluteUrl(req, profile.profile_picture),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin: download the exact provider profile photo originally uploaded.
 */
async function downloadProviderProfilePhoto(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) throw new HttpError(400, 'Invalid provider id');

    const provider = await db.User.findByPk(id, {
      attributes: ['id', 'role'],
      include: [{ model: db.DriverProfile, as: 'driver_profile', attributes: ['profile_picture'] }],
    });
    if (!provider || provider.role !== 'driver') throw new HttpError(404, 'Service provider not found');

    const storedPhoto = provider.driver_profile?.profile_picture;
    if (!storedPhoto) throw new HttpError(404, 'Provider profile photo not found');

    let publicPath = String(storedPhoto);
    try {
      publicPath = new URL(publicPath).pathname;
    } catch (_err) {
      // Relative upload paths are already accepted by publicPathToDiskPath.
    }

    const sourcePath = publicPathToDiskPath(publicPath);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new HttpError(404, 'Provider profile photo file not found');
    }

    const extension = path.extname(sourcePath).toLowerCase() || '.img';
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
      '.heic': 'image/heic',
      '.avif': 'image/avif',
    };
    const stat = fs.statSync(sourcePath);

    res.set({
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="provider-${id}-profile-photo${extension}"`,
      'Cache-Control': 'private, no-store',
    });
    const stream = fs.createReadStream(sourcePath);
    stream.on('error', next);
    return stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin: update a service provider's core profile fields.
 * Supports: first_name, last_name, email, phone, country_code (user table)
 *           date_of_birth, address, social_security_number (step_data step 1)
 *           drivers_license_number, drivers_license_issued_date,
 *           drivers_license_expiration_date (step_data step 3)
 */
async function updateProviderProfile(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) throw new HttpError(400, 'Invalid provider id');

    const provider = await db.User.findByPk(id, {
      attributes: ['id', 'role', 'name', 'first_name', 'last_name', 'email', 'phone', 'country_code'],
      include: [{ model: db.DriverProfile, as: 'driver_profile', attributes: ['id', 'user_id', 'step_data', 'current_step'] }],
    });
    if (!provider || provider.role !== 'driver') throw new HttpError(404, 'Service provider not found');

    const {
      first_name,
      last_name,
      email,
      phone,
      country_code,
      date_of_birth,
      address,
      social_security_number,
      drivers_license_number,
      drivers_license_issued_date,
      drivers_license_expiration_date,
    } = req.body;

    const userUpdates = {};
    if (first_name !== undefined) userUpdates.first_name = String(first_name).trim();
    if (last_name  !== undefined) userUpdates.last_name  = String(last_name).trim();
    if (email      !== undefined) {
      const trimmed = String(email).trim().toLowerCase();
      if (!trimmed.includes('@')) throw new HttpError(400, 'Invalid email address');
      const currentEmail = String(provider.email || '').trim().toLowerCase();
      if (trimmed !== currentEmail) {
        const existing = await db.User.findOne({ where: { email: trimmed } });
        if (existing && Number(existing.id) !== id) throw new HttpError(409, 'Email already in use by another account');
        userUpdates.email = trimmed;
      }
    }
    if (phone !== undefined) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      if (normalizedPhone.length < 6 || normalizedPhone.length > 32) {
        throw new HttpError(400, 'Phone number must contain 6 to 32 digits');
      }

      if (normalizedPhone !== String(provider.phone || '').replace(/\D/g, '')) {
        const existingProvider = await db.User.findOne({
          where: {
            role: 'driver',
            phone: normalizedPhone,
            id: { [Op.ne]: id },
          },
          attributes: ['id'],
        });
        if (existingProvider) {
          throw new HttpError(409, 'Phone number is already in use by another service provider');
        }
        userUpdates.phone = normalizedPhone;
      }
    }
    if (country_code !== undefined) {
      const normalizedCountryCode = String(country_code).trim();
      if (!/^\+\d{1,4}$/.test(normalizedCountryCode)) {
        throw new HttpError(400, 'Country code must be a calling code like +1 or +91');
      }
      userUpdates.country_code = normalizedCountryCode;
    }

    if (Object.keys(userUpdates).length) await provider.update(userUpdates);

    // ── step_data ─────────────────────────────────────────────────────────────
    // The driver signup flow stores personal info in step 2 and license in step 3,
    // wrapped under a "steps" key: { steps: { "2": {...}, "3": {...} } }.
    // We align with that canonical format so the mobile app always sees consistent data.
    const stepData2Updates = {}; // personal info (aligns with driver signup step 2)
    if (date_of_birth          !== undefined) stepData2Updates.date_of_birth          = String(date_of_birth).trim();
    if (address                !== undefined) stepData2Updates.address                = String(address).trim();
    if (social_security_number !== undefined) stepData2Updates.social_security_number = String(social_security_number).trim();

    const stepData3Updates = {}; // license info
    if (drivers_license_number          !== undefined) stepData3Updates.drivers_license_number          = String(drivers_license_number).trim();
    if (drivers_license_issued_date     !== undefined) stepData3Updates.drivers_license_issued_date     = String(drivers_license_issued_date).trim();
    if (drivers_license_expiration_date !== undefined) stepData3Updates.drivers_license_expiration_date = String(drivers_license_expiration_date).trim();

    if (Object.keys(stepData2Updates).length || Object.keys(stepData3Updates).length) {
      let profile = provider.driver_profile;
      if (!profile) {
        profile = await db.DriverProfile.create({ user_id: id, step_data: { steps: {} } });
      }

      const existing = profile.step_data || {};

      // Normalise legacy root-level format ({ "1": {...} }) → canonical { steps: {...} }.
      // If there is no "steps" key we promote the root entries into the wrapper.
      let existingSteps;
      if (existing.steps && typeof existing.steps === 'object') {
        existingSteps = { ...existing.steps };
        // Migrate any stale root-level step keys ("1", "2", "3" …) into the wrapper.
        for (const k of Object.keys(existing)) {
          if (k !== 'steps' && /^\d+$/.test(k)) {
            existingSteps[k] = Object.assign({}, existingSteps[k] || {}, existing[k]);
          }
        }
      } else {
        // Legacy flat format — lift everything into the steps wrapper,
        // mapping old step "1" personal-info data into step "2" to match the app.
        existingSteps = {};
        for (const k of Object.keys(existing)) {
          if (/^\d+$/.test(k)) {
            const targetKey = k === '1' ? '2' : k; // remap step 1 → step 2
            existingSteps[targetKey] = Object.assign({}, existingSteps[targetKey] || {}, existing[k]);
          }
        }
      }

      if (Object.keys(stepData2Updates).length) {
        existingSteps['2'] = Object.assign({}, existingSteps['2'] || {}, stepData2Updates);
      }
      if (Object.keys(stepData3Updates).length) {
        existingSteps['3'] = Object.assign({}, existingSteps['3'] || {}, stepData3Updates);
      }

      await profile.update({ step_data: { steps: existingSteps } });
    }

    return res.status(200).json({
      success: true,
      message: 'Provider profile updated successfully.',
      data: { user_id: id },
    });
  } catch (err) {
    return next(mapProviderProfileUniqueConstraintError(err) || err);
  }
}

async function getProviderLoginHistory(req, res, next) {
  try {
    const { id } = req.params;
    const user = await db.User.findOne({ where: { id, role: 'driver' } });
    if (!user) throw new HttpError(404, 'Provider not found');

    const devices = await db.UserDevice.findAll({
      where: { user_id: id },
      order: [['updated_at', 'DESC']],
    });

    const login_history = devices.map((d) => ({
      id: d.id,
      platform: d.platform || null,
      device_model: d.device_model || null,
      app_version: d.app_version || null,
      is_active: d.is_active,
      last_login_at: d.last_login_at || d.updated_at || null,
      last_login_ip: d.last_login_ip || null,
      registered_at: d.created_at || null,
    }));

    return res.success('Login history retrieved', { login_history });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProviders,
  getProvider,
  downloadProviderServiceRecord,
  downloadProviderProfilePhoto,
  updateProviderStatus,
  approveProvider,
  rejectProvider,
  updateInsuranceStatus,
  resetProviderPassword,
  uploadProviderProfilePhoto,
  updateProviderProfile,
  getProviderLoginHistory,
};
