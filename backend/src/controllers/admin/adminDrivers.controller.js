const { Op } = require("sequelize");
const db = require("../../models");
const { HttpError } = require("../../utils/httpError");
const { toAdminProviderJson, mapAdminPlainList } = require("../../utils/adminJson");

async function listDrivers(req, res, next) {
  try {
    const { page = 1, limit = 10, search, approval_status, sort = "created_at", order = "desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (approval_status) {
      where.approval_status = approval_status;
    }

    const include = [
      {
        model: db.User,
        as: "user",
        attributes: ["id", "name", "first_name", "last_name", "email", "phone", "country_code", "is_verified", "created_at"],
        where: {},
      },
    ];

    if (search) {
      include[0].where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ["created_at", "approval_status"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

    const { count, rows } = await db.DriverProfile.findAndCountAll({
      where,
      include,
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    return res.success("Service providers fetched", {
      rows: mapAdminPlainList(rows),
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

async function getDriver(req, res, next) {
  try {
    const { driverId } = req.params;

    const user = await db.User.findOne({
      where: { id: driverId, role: "driver" },
      attributes: { exclude: ["password", "token_version", "otp_code", "otp_expiry"] },
      include: [
        { model: db.DriverProfile, as: "driver_profile" },
        { model: db.Vehicle, as: "vehicles", include: [{ model: db.VehicleImage, as: "images" }] },
      ],
    });

    if (!user) throw new HttpError(404, "Service provider not found");

    const bookings = await db.Booking.findAll({
      where: { assigned_driver_user_id: driverId, status: { [Op.ne]: "draft" } },
      include: [
        { model: db.User, as: "user", attributes: ["id", "name", "email"] },
        { model: db.Vehicle, as: "vehicle", attributes: ["id", "make", "model", "license_plate"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    const statusBreakdown = {};
    for (const b of bookings) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
    }

    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalEarnings = completedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

    const reviews = await db.Review.findAll({
      where: { reviewee_user_id: driverId },
      include: [
        { model: db.User, as: "reviewer", attributes: ["id", "name", "email"] },
        { model: db.ReviewImage, as: "images" },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

    return res.success("Service provider fetched", {
      user: toAdminProviderJson(user),
      bookings: mapAdminPlainList(bookings),
      stats: {
        total_bookings: bookings.length,
        status_breakdown: statusBreakdown,
        completed_bookings: completedBookings.length,
        total_earnings: totalEarnings.toFixed(2),
        total_reviews: reviews.length,
        avg_rating: avgRating,
      },
      reviews: mapAdminPlainList(reviews),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listDrivers, getDriver };
