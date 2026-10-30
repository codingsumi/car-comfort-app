const { Op, fn, col, literal } = require("sequelize");
const db = require("../../models");

/**
 * Returns last N days of daily counts for a model.
 * @param {object} model - Sequelize model
 * @param {object} where - extra where clause
 * @param {number} days
 */
async function getDailySparkline(model, where = {}, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const rows = await model.findAll({
    where: { ...where, created_at: { [Op.gte]: since } },
    attributes: [
      [fn('DATE', col('created_at')), 'day'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[literal('day'), 'ASC']],
    raw: true,
  });

  // Fill in missing days with 0
  const map = {};
  for (const r of rows) map[r.day] = Number(r.count);
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: key, count: map[key] || 0 });
  }
  return result;
}

async function getRevenueDailySparkline(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const rows = await db.Booking.findAll({
    where: { status: 'completed', created_at: { [Op.gte]: since } },
    attributes: [
      [fn('DATE', col('created_at')), 'day'],
      [fn('SUM', col('total_price')), 'total'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[literal('day'), 'ASC']],
    raw: true,
  });

  const map = {};
  for (const r of rows) map[r.day] = parseFloat(r.total || 0);
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: key, total: map[key] || 0 });
  }
  return result;
}

/**
 * Period-over-period change percent.
 * currentPeriod vs previousPeriod (same length).
 */
async function getPeriodChange(model, where = {}, days = 7) {
  const now = new Date();
  const periodStart = new Date(now); periodStart.setDate(now.getDate() - days); periodStart.setHours(0,0,0,0);
  const prevStart = new Date(now); prevStart.setDate(now.getDate() - days * 2); prevStart.setHours(0,0,0,0);

  const [current, previous] = await Promise.all([
    model.count({ where: { ...where, created_at: { [Op.gte]: periodStart } } }),
    model.count({ where: { ...where, created_at: { [Op.gte]: prevStart, [Op.lt]: periodStart } } }),
  ]);

  const change = previous === 0
    ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / previous) * 100);

  return { current, previous, change };
}

async function getRevenuePeriodChange(days = 7) {
  const now = new Date();
  const periodStart = new Date(now); periodStart.setDate(now.getDate() - days); periodStart.setHours(0,0,0,0);
  const prevStart = new Date(now); prevStart.setDate(now.getDate() - days * 2); prevStart.setHours(0,0,0,0);

  const [cur, prev] = await Promise.all([
    db.Booking.sum('total_price', { where: { status: 'completed', created_at: { [Op.gte]: periodStart } } }),
    db.Booking.sum('total_price', { where: { status: 'completed', created_at: { [Op.gte]: prevStart, [Op.lt]: periodStart } } }),
  ]);
  const current = parseFloat(cur || 0);
  const previous = parseFloat(prev || 0);
  const change = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
  return { current, previous, change };
}

async function getStats(req, res, next) {
  try {
    const [totalUsers, totalDrivers, totalCustomers, totalBookings, pendingDriverApprovals] =
      await Promise.all([
        db.User.count(),
        db.User.count({ where: { role: "driver" } }),
        db.User.count({ where: { role: "customer" } }),
        db.Booking.count({ where: { status: { [Op.ne]: "draft" } } }),
        db.DriverProfile.count({ where: { approval_status: "pending" } }),
      ]);

    const revenueResult = await db.Booking.sum("total_price", {
      where: { status: "completed" },
    });

    const activeBookings = await db.Booking.count({
      where: { status: { [Op.in]: ["confirmed", "assigned", "in_progress"] } },
    });

    const recentBookings = await db.Booking.findAll({
      where: { status: { [Op.ne]: "draft" } },
      include: [
        { model: db.User, as: "user", attributes: ["id", "name", "email"] },
        { model: db.User, as: "assigned_driver", attributes: ["id", "name", "email"] },
        { model: db.Vehicle, as: "vehicle", attributes: ["id", "make", "model", "license_plate"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    // Sparklines (last 7 days)
    const [userSparkline, bookingSparkline, revenueSparkline, customerSparkline] = await Promise.all([
      getDailySparkline(db.User, {}, 7),
      getDailySparkline(db.Booking, { status: { [Op.ne]: 'draft' } }, 7),
      getRevenueDailySparkline(7),
      getDailySparkline(db.User, { role: 'customer' }, 7),
    ]);

    // Period-over-period (7-day vs prior 7-day)
    const [userTrend, bookingTrend, revenueTrend, customerTrend, driverTrend] = await Promise.all([
      getPeriodChange(db.User, {}, 7),
      getPeriodChange(db.Booking, { status: { [Op.ne]: 'draft' } }, 7),
      getRevenuePeriodChange(7),
      getPeriodChange(db.User, { role: 'customer' }, 7),
      getPeriodChange(db.User, { role: 'driver' }, 7),
    ]);

    return res.success("Dashboard stats fetched", {
      totalUsers,
      totalDrivers,
      totalCustomers,
      totalBookings,
      totalRevenue: parseFloat(revenueResult || 0),
      activeBookings,
      pendingDriverApprovals,
      recentBookings,
      sparklines: {
        users: userSparkline,
        bookings: bookingSparkline,
        revenue: revenueSparkline,
        customers: customerSparkline,
      },
      trends: {
        users: userTrend,
        bookings: bookingTrend,
        revenue: revenueTrend,
        customers: customerTrend,
        drivers: driverTrend,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getStats };
