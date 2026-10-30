const { Op } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { assignSystemPassword, setUserPassword } = require('../../services/userPassword.service');
const { sendPasswordUpdatedEmail } = require('../../services/lifecycleEmail.service');
const { toAdminUserJson, mapAdminPlainList } = require('../../utils/adminJson');

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

function mapCustomerProfileUniqueConstraintError(err) {
  if (String(err?.name || '') !== 'SequelizeUniqueConstraintError') return null;

  const fields = err?.fields || {};
  const errorPaths = Array.isArray(err?.errors) ? err.errors.map((item) => item.path) : [];
  if (fields.phone || fields.phone_2 || errorPaths.includes('phone')) {
    return new HttpError(409, 'Phone number is already in use by another customer');
  }
  if (fields.email || fields.email_2 || errorPaths.includes('email')) {
    return new HttpError(409, 'Email is already in use by another customer');
  }

  return new HttpError(409, 'Another customer already uses one of these contact details');
}

async function listCustomers(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sort = 'created_at',
      order = 'desc',
      date_from,
      date_to,
      min_bookings,
      max_bookings,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = { role: 'customer' };

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) where.created_at[Op.lte] = new Date(date_to);
    }

    const validSortFields = ['created_at', 'name', 'email', 'status'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const { count, rows } = await db.User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry'] },
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    const customerIds = rows.map((u) => u.id);
    let bookingCounts = {};
    let spentAmounts = {};

    if (customerIds.length > 0) {
      const bookingStats = await db.Booking.findAll({
        where: { user_id: { [Op.in]: customerIds }, status: { [Op.ne]: 'draft' } },
        attributes: [
          'user_id',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total_bookings'],
          [db.sequelize.fn('SUM', db.sequelize.literal("CASE WHEN status = 'completed' THEN COALESCE(total_price, 0) ELSE 0 END")), 'total_spent'],
        ],
        group: ['user_id'],
        raw: true,
      });

      for (const stat of bookingStats) {
        bookingCounts[stat.user_id] = parseInt(stat.total_bookings) || 0;
        spentAmounts[stat.user_id] = parseFloat(stat.total_spent) || 0;
      }
    }

    let customers = rows.map((user) => ({
      ...toAdminUserJson(user),
      total_bookings: bookingCounts[user.id] || 0,
      total_spent: (spentAmounts[user.id] || 0).toFixed(2),
    }));

    if (min_bookings || max_bookings) {
      const minB = parseInt(min_bookings) || 0;
      const maxB = parseInt(max_bookings) || Infinity;
      customers = customers.filter(
        (c) => c.total_bookings >= minB && c.total_bookings <= maxB
      );
    }

    return res.success('Customers fetched', {
      customers,
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

async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;

    const user = await db.User.findOne({
      where: { id, role: 'customer' },
      attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry'] },
    });
    if (!user) throw new HttpError(404, 'Customer not found');

    const bookings = await db.Booking.findAll({
      where: { user_id: id, status: { [Op.ne]: 'draft' } },
      include: [
        { model: db.User, as: 'assigned_driver', attributes: ['id', 'name', 'email'] },
        { model: db.Vehicle, as: 'vehicle', attributes: ['id', 'make', 'model', 'license_plate', 'color'] },
        { model: db.Package, as: 'package', attributes: ['id', 'name'], include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }] },
      ],
      order: [['created_at', 'DESC']],
    });

    const vehicles = await db.Vehicle.findAll({
      where: { user_id: id },
      include: [{ model: db.VehicleImage, as: 'images' }],
      order: [['created_at', 'DESC']],
    });

    const transactions = await db.BookingTransaction.findAll({
      where: { user_id: id },
      include: [
        { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code', 'status', 'service_type'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const reviews = await db.Review.findAll({
      where: { reviewer_user_id: id },
      include: [
        { model: db.User, as: 'reviewee', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const succeededTx = transactions.filter((t) => t.status === 'succeeded');
    const totalPaid = succeededTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
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
      total_spent: totalPaid.toFixed(2),
      total_transactions: transactions.length,
      succeeded_transactions: succeededTx.length,
      total_vehicles: vehicles.length,
      total_reviews: reviews.length,
      avg_rating: avgRating,
      completed_bookings: completedBookings.length,
      completion_rate: bookings.length
        ? ((completedBookings.length / bookings.length) * 100).toFixed(1)
        : '0.0',
    };

    return res.success('Customer fetched', {
      user: toAdminUserJson(user),
      stats,
      bookings: mapAdminPlainList(bookings),
      vehicles: mapAdminPlainList(vehicles),
      transactions: mapAdminPlainList(transactions),
      reviews: mapAdminPlainList(reviews),
    });
  } catch (err) {
    return next(err);
  }
}

async function updateCustomerStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.auth.userId;

    if (!['active', 'suspended', 'deactivated'].includes(status)) {
      throw new HttpError(400, 'status must be one of: active, suspended, deactivated');
    }

    const user = await db.User.findOne({ where: { id, role: 'customer' } });
    if (!user) throw new HttpError(404, 'Customer not found');

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
      `customer_status_${status}`,
      'user',
      user.id,
      { previous_status: previousStatus, new_status: status, reason },
      getClientIp(req)
    );

    return res.success(`Customer ${status} successfully`, {
      user: { id: user.id, status: user.status },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateCustomerProfile(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || id < 1) throw new HttpError(400, 'Invalid customer id');

    const user = await db.User.findOne({
      where: { id, role: 'customer' },
      attributes: ['id', 'name', 'first_name', 'last_name', 'email', 'phone', 'country_code'],
    });
    if (!user) throw new HttpError(404, 'Customer not found');

    const { first_name, last_name, email, phone, country_code } = req.body || {};
    const updates = {};

    if (first_name !== undefined) {
      const value = String(first_name).trim();
      if (!value || value.length > 60) throw new HttpError(400, 'First name must be between 1 and 60 characters');
      updates.first_name = value;
    }
    if (last_name !== undefined) {
      const value = String(last_name).trim();
      if (!value || value.length > 60) throw new HttpError(400, 'Last name must be between 1 and 60 characters');
      updates.last_name = value;
    }
    if (email !== undefined) {
      const value = String(email).trim().toLowerCase();
      if (!value || !value.includes('@')) throw new HttpError(400, 'Invalid email address');
      if (value !== String(user.email || '').trim().toLowerCase()) {
        const existing = await db.User.findOne({ where: { role: 'customer', email: value, id: { [Op.ne]: id } }, attributes: ['id'] });
        if (existing) throw new HttpError(409, 'Email is already in use by another customer');
        updates.email = value;
      }
    }
    if (phone !== undefined) {
      const value = String(phone).replace(/\D/g, '');
      if (value.length < 6 || value.length > 32) throw new HttpError(400, 'Phone number must contain 6 to 32 digits');
      if (value !== String(user.phone || '').replace(/\D/g, '')) {
        const existing = await db.User.findOne({ where: { role: 'customer', phone: value, id: { [Op.ne]: id } }, attributes: ['id'] });
        if (existing) throw new HttpError(409, 'Phone number is already in use by another customer');
        updates.phone = value;
      }
    }
    if (country_code !== undefined) {
      const value = String(country_code).trim();
      if (!/^\+\d{1,4}$/.test(value)) throw new HttpError(400, 'Country code must be a calling code like +1 or +91');
      updates.country_code = value;
    }

    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      updates.name = `${updates.first_name ?? user.first_name ?? ''} ${updates.last_name ?? user.last_name ?? ''}`.trim() || user.name;
    }
    if (!Object.keys(updates).length) throw new HttpError(400, 'No profile changes provided');

    await user.update(updates);
    await logAudit(req.auth.userId, 'customer_profile_updated', 'user', user.id, {
      changed_fields: Object.keys(updates),
    }, getClientIp(req));

    return res.success('Customer profile updated successfully', { user_id: user.id });
  } catch (err) {
    return next(mapCustomerProfileUniqueConstraintError(err) || err);
  }
}

async function resetCustomerPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password, notify_email } = req.body || {};
    const adminId = req.auth.userId;

    const user = await db.User.findOne({ where: { id, role: 'customer' } });
    if (!user) throw new HttpError(404, 'Customer not found');

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
      'customer_password_reset',
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
        ? 'Password updated and emailed to the customer. All sessions were invalidated.'
        : 'Share this password securely with the customer. All sessions were invalidated.',
    });
  } catch (err) {
    return next(err);
  }
}

async function getCustomerLoginHistory(req, res, next) {
  try {
    const { id } = req.params;
    const user = await db.User.findOne({ where: { id, role: 'customer' } });
    if (!user) throw new HttpError(404, 'Customer not found');

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

module.exports = { listCustomers, getCustomer, updateCustomerStatus, updateCustomerProfile, resetCustomerPassword, getCustomerLoginHistory };
