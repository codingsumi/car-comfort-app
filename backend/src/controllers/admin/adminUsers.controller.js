const { Op } = require("sequelize");
const db = require("../../models");
const { HttpError } = require("../../utils/httpError");
const { toAdminUserJson, toAdminPlainJson, mapAdminPlainList } = require("../../utils/adminJson");

const VALID_ROLES = ["customer", "driver", "admin", "garage"];

async function getUser(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await db.User.findByPk(userId, {
      attributes: { exclude: ["password", "token_version", "otp_code", "otp_expiry"] },
    });
    if (!user) throw new HttpError(404, "User not found");

    let stats = null;
    let bookings = [];
    let transactions = [];
    let vehicles = [];
    let reviews = [];
    let driverProfile = null;

    if (user.role === "customer") {
      const allBookings = await db.Booking.findAll({
        where: { user_id: userId, status: { [Op.ne]: "draft" } },
        include: [
          { model: db.User, as: "assigned_driver", attributes: ["id", "name", "email"] },
          { model: db.Vehicle, as: "vehicle", attributes: ["id", "make", "model", "license_plate"] },
          { model: db.Package, as: "package", attributes: ["id", "name"] },
        ],
        order: [["created_at", "DESC"]],
      });

      bookings = allBookings;

      const statusBreakdown = {};
      for (const b of allBookings) {
        statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
      }

      const serviceBreakdown = {};
      for (const b of allBookings) {
        serviceBreakdown[b.service_type] = (serviceBreakdown[b.service_type] || 0) + 1;
      }

      const completedBookings = allBookings.filter((b) => b.status === "completed");
      const totalRevenue = completedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

      transactions = await db.BookingTransaction.findAll({
        where: { user_id: userId },
        include: [
          { model: db.Booking, as: "booking", attributes: ["id", "booking_code", "status", "service_type"] },
        ],
        order: [["created_at", "DESC"]],
      });

      const succeededTx = transactions.filter((t) => t.status === "succeeded");
      const totalPaid = succeededTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      vehicles = await db.Vehicle.findAll({
        where: { user_id: userId },
        include: [{ model: db.VehicleImage, as: "images" }],
        order: [["created_at", "DESC"]],
      });

      reviews = await db.Review.findAll({
        where: { reviewer_user_id: userId },
        include: [
          { model: db.User, as: "reviewee", attributes: ["id", "name", "email"] },
          { model: db.ReviewImage, as: "images" },
        ],
        order: [["created_at", "DESC"]],
      });

      const avgRating = reviews.length
        ? (reviews.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1)
        : null;

      const cancelledBookings = allBookings.filter((b) => b.status === "cancelled");
      const totalRefunds = cancelledBookings.reduce((sum, b) => sum + parseFloat(b.refund_amount || 0), 0);
      const totalCancellationFees = cancelledBookings.reduce((sum, b) => sum + parseFloat(b.cancellation_fee || 0), 0);

      stats = {
        total_bookings: allBookings.length,
        status_breakdown: statusBreakdown,
        service_breakdown: serviceBreakdown,
        total_revenue: totalRevenue.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        total_transactions: transactions.length,
        succeeded_transactions: succeededTx.length,
        total_vehicles: vehicles.length,
        total_reviews: reviews.length,
        avg_rating: avgRating,
        total_cancellations: cancelledBookings.length,
        total_refunds: totalRefunds.toFixed(2),
        total_cancellation_fees: totalCancellationFees.toFixed(2),
        completion_rate: allBookings.length
          ? ((completedBookings.length / allBookings.length) * 100).toFixed(1)
          : "0.0",
      };
    } else if (user.role === "driver") {
      driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });

      const allBookings = await db.Booking.findAll({
        where: { assigned_driver_user_id: userId, status: { [Op.ne]: "draft" } },
        include: [
          { model: db.User, as: "user", attributes: ["id", "name", "email"] },
          { model: db.Vehicle, as: "vehicle", attributes: ["id", "make", "model", "license_plate"] },
          { model: db.Package, as: "package", attributes: ["id", "name"] },
        ],
        order: [["created_at", "DESC"]],
      });

      bookings = allBookings;

      const statusBreakdown = {};
      for (const b of allBookings) {
        statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
      }

      const completedBookings = allBookings.filter((b) => b.status === "completed");
      const totalEarnings = completedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

      reviews = await db.Review.findAll({
        where: { reviewee_user_id: userId },
        include: [
          { model: db.User, as: "reviewer", attributes: ["id", "name", "email"] },
          { model: db.ReviewImage, as: "images" },
        ],
        order: [["created_at", "DESC"]],
      });

      const avgRating = reviews.length
        ? (reviews.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1)
        : null;

      stats = {
        total_bookings: allBookings.length,
        status_breakdown: statusBreakdown,
        completed_bookings: completedBookings.length,
        total_earnings: totalEarnings.toFixed(2),
        total_reviews: reviews.length,
        avg_rating: avgRating,
        completion_rate: allBookings.length
          ? ((completedBookings.length / allBookings.length) * 100).toFixed(1)
          : "0.0",
      };
    }

    return res.success("User fetched", {
      user: toAdminUserJson(user),
      stats,
      bookings: mapAdminPlainList(bookings),
      transactions: mapAdminPlainList(transactions),
      vehicles: mapAdminPlainList(vehicles),
      reviews: mapAdminPlainList(reviews),
      driverProfile: driverProfile ? toAdminPlainJson(driverProfile) : null,
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, "User not found");
    if (user.role === "admin") throw new HttpError(403, "Cannot delete admin users");
    const auditLogService = require("../../services/auditLog.service");
    const platformReportsService = require("../../services/platformReports.service");
    await auditLogService.logAdminAction({
      adminId: req.auth?.userId,
      actionType: "user_permanent_delete",
      entityType: "user",
      entityId: user.id,
      oldValues: { email: user.email, name: user.name, role: user.role },
      ipAddress: platformReportsService.getClientIp(req),
      module: "compliance",
      severity: "critical",
    });
    await user.destroy();
    return res.success("User deleted successfully");
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { type, page = 1, limit = 10, search } = req.query;

    if (!type) throw new HttpError(400, "type is required");
    const listAllRoles = type === "all";
    if (!listAllRoles && !VALID_ROLES.includes(type)) {
      throw new HttpError(400, `type must be one of: all, ${VALID_ROLES.join(", ")}`);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = listAllRoles ? { role: { [Op.ne]: "admin" } } : { role: type };

    if (search) {
      const term = String(search).trim().slice(0, 120);
      where[Op.or] = [
        { name: { [Op.like]: `%${term}%` } },
        { first_name: { [Op.like]: `%${term}%` } },
        { last_name: { [Op.like]: `%${term}%` } },
        { email: { [Op.like]: `%${term}%` } },
        { phone: { [Op.like]: `%${term}%` } },
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where,
      attributes: { exclude: ["password", "token_version", "otp_code", "otp_expiry"] },
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset,
    });

    return res.success("Users fetched successfully", {
      users: rows.map((u) => toAdminUserJson(u)),
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

// ─── CREATE ADMIN USER ──────────────────────────────────────────────────────

async function createAdmin(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      throw new HttpError(400, 'name, email, and password are required');
    }
    const existing = await db.User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) throw new HttpError(409, 'An account with this email already exists');

    const { hashPassword } = require('../../services/userPassword.service');
    const hashed = await hashPassword(password);

    const user = await db.User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      password: hashed,
      role: 'admin',
      status: 'active',
      is_verified: true,
    });

    const auditLogService = require('../../services/auditLog.service');
    const platformReportsService = require('../../services/platformReports.service');
    await auditLogService.logAdminAction({
      adminId: req.auth?.userId,
      actionType: 'admin_created',
      entityType: 'user',
      entityId: user.id,
      newValues: { email: user.email, name: user.name },
      ipAddress: platformReportsService.getClientIp(req),
      module: 'user_management',
      severity: 'high',
    });

    return res.success('Admin user created', { id: user.id, name: user.name, email: user.email }, 201);
  } catch (err) {
    return next(err);
  }
}

// ─── UPDATE ADMIN USER ───────────────────────────────────────────────────────

async function updateAdmin(req, res, next) {
  try {
    const { userId } = req.params;
    const requestingAdminId = req.auth?.userId;
    const { name, phone, status, suspended_reason } = req.body;

    const user = await db.User.findOne({ where: { id: userId, role: 'admin' } });
    if (!user) throw new HttpError(404, 'Admin user not found');

    // Prevent self-deactivation
    if (status && status !== 'active' && String(userId) === String(requestingAdminId)) {
      throw new HttpError(403, 'You cannot deactivate or suspend your own account');
    }

    const oldValues = { name: user.name, phone: user.phone, status: user.status };
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone || null;
    if (status !== undefined) {
      if (!['active', 'suspended', 'deactivated'].includes(status)) {
        throw new HttpError(400, 'Invalid status value');
      }
      updateData.status = status;
      if (status === 'suspended') {
        updateData.suspended_reason = suspended_reason || null;
        updateData.suspended_at = new Date();
      } else if (status === 'deactivated') {
        updateData.deactivated_at = new Date();
      } else if (status === 'active') {
        updateData.suspended_reason = null;
        updateData.suspended_at = null;
      }
    }

    await user.update(updateData);

    const auditLogService = require('../../services/auditLog.service');
    const platformReportsService = require('../../services/platformReports.service');
    await auditLogService.logAdminAction({
      adminId: requestingAdminId,
      actionType: 'admin_updated',
      entityType: 'user',
      entityId: user.id,
      oldValues,
      newValues: updateData,
      ipAddress: platformReportsService.getClientIp(req),
      module: 'user_management',
      severity: 'medium',
    });

    return res.success('Admin user updated', toAdminUserJson(user));
  } catch (err) {
    return next(err);
  }
}

module.exports = { listUsers, getUser, deleteUser, createAdmin, updateAdmin };
