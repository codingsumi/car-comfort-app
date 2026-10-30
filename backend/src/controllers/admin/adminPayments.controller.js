const { Op } = require("sequelize");
const db = require("../../models");

async function listPayments(req, res, next) {
  try {
    const { page = 1, limit = 10, search, status, sort = "created_at", order = "desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { transaction_code: { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ["created_at", "amount", "status"];
    const sortField = validSortFields.includes(sort) ? sort : "created_at";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

    const { count, rows } = await db.BookingTransaction.findAndCountAll({
      where,
      include: [
        { model: db.User, as: "user", attributes: ["id", "name", "email"] },
        { model: db.Booking, as: "booking", attributes: ["id", "booking_code", "status", "service_type"] },
      ],
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
    });

    return res.success("Payments fetched", {
      rows,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listPayments };
