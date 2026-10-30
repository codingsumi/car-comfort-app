const crypto = require('crypto');
const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');
const { parseDateRange } = require('../utils/reportDateRange');
const {
  getRevenueReport,
  getRefundReport,
} = require('./financialReport.service');

const CACHE_TTL_MS = 15 * 60 * 1000;
const ACTIVE_STATUSES = ['confirmed', 'assigned', 'in_progress'];
const COMPLETED_STATUSES = ['completed', 'refunded'];

function buildFiltersHash(query) {
  const key = JSON.stringify({
    from: query.from_date,
    to: query.to_date,
    period: query.period,
    service_type: query.service_type,
    status: query.status,
    provider_id: query.provider_id,
    location: query.location,
  });
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

async function getCachedMetric(metricType, query, computeFn) {
  const filtersHash = buildFiltersHash(query);
  const { start } = parseDateRange(query);
  const dateKey = start.toISOString().slice(0, 10);

  const cached = await db.AnalyticsCache.findOne({
    where: { metric_type: metricType, date: dateKey, filters_hash: filtersHash },
    order: [['generated_at', 'DESC']],
  });

  if (cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_TTL_MS) {
    return cached.metric_value;
  }

  const value = await computeFn();
  await db.AnalyticsCache.upsert({
    metric_type: metricType,
    metric_value: value,
    date: dateKey,
    filters_hash: filtersHash,
    generated_at: new Date(),
  });

  return value;
}

function bookingDateFilter(start, end) {
  return { created_at: { [Op.between]: [start, end] }, status: { [Op.ne]: 'draft' } };
}

async function getDashboard(query) {
  return getCachedMetric('dashboard', query, async () => {
    const { start, end } = parseDateRange(query);
    const rangeWhere = bookingDateFilter(start, end);

    const [
      totalUsers,
      totalCustomers,
      totalProviders,
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      revenueTotals,
      avgRating,
      registrationTrend,
      providerGrowth,
      bookingTrend,
      revenueTrend,
      cancellationTrend,
      refundTrend,
      categoryPerformance,
      retentionTrend,
    ] = await Promise.all([
      db.User.count(),
      db.User.count({ where: { role: 'customer' } }),
      db.User.count({ where: { role: 'driver' } }),
      db.Booking.count({ where: { status: { [Op.ne]: 'draft' } } }),
      db.Booking.count({ where: { status: { [Op.in]: ACTIVE_STATUSES } } }),
      db.Booking.count({ where: { status: 'completed' } }),
      db.Booking.count({ where: { status: 'cancelled' } }),
      db.Booking.findAll({
        where: {
          status: { [Op.in]: COMPLETED_STATUSES },
          created_at: { [Op.between]: [start, end] },
        },
        attributes: [
          [fn('SUM', col('total_price')), 'gross_revenue'],
          [fn('SUM', col('platform_fee')), 'platform_commission'],
          [fn('SUM', col('refund_amount')), 'refund_totals'],
          [fn('COUNT', col('id')), 'booking_count'],
        ],
        raw: true,
      }),
      db.Review.findOne({
        attributes: [[fn('AVG', col('rating')), 'avg_rating']],
        raw: true,
      }),
      db.User.findAll({
        where: { created_at: { [Op.between]: [start, end] } },
        attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.User.findAll({
        where: { role: 'driver', created_at: { [Op.between]: [start, end] } },
        attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.Booking.findAll({
        where: rangeWhere,
        attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.Booking.findAll({
        where: {
          status: { [Op.in]: COMPLETED_STATUSES },
          created_at: { [Op.between]: [start, end] },
        },
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('SUM', col('total_price')), 'revenue'],
        ],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.Booking.findAll({
        where: { status: 'cancelled', created_at: { [Op.between]: [start, end] } },
        attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.Booking.findAll({
        where: {
          status: { [Op.in]: COMPLETED_STATUSES },
          created_at: { [Op.between]: [start, end] },
        },
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('SUM', col('refund_amount')), 'amount'],
        ],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      db.Booking.findAll({
        where: {
          status: { [Op.in]: COMPLETED_STATUSES },
          created_at: { [Op.between]: [start, end] },
        },
        attributes: [
          'service_type',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total_price')), 'revenue'],
        ],
        group: ['service_type'],
        raw: true,
      }),
      getRetentionTrend(start, end),
    ]);

    const rev = revenueTotals[0] || {};
    const grossRevenue = parseFloat(rev.gross_revenue || 0);
    const refundTotals = parseFloat(rev.refund_totals || 0);
    const platformCommission = parseFloat(rev.platform_commission || 0);
    const bookingCount = parseInt(rev.booking_count || 0);
    const netRevenue = grossRevenue - refundTotals;
    const avgBookingValue = bookingCount > 0 ? grossRevenue / bookingCount : 0;

    return {
      summary: {
        total_users: totalUsers,
        total_customers: totalCustomers,
        total_providers: totalProviders,
        total_bookings: totalBookings,
        active_bookings: activeBookings,
        completed_bookings: completedBookings,
        cancelled_bookings: cancelledBookings,
        gross_revenue: grossRevenue,
        net_revenue: parseFloat(netRevenue.toFixed(2)),
        platform_commission: platformCommission,
        refund_totals: refundTotals,
        average_booking_value: parseFloat(avgBookingValue.toFixed(2)),
        customer_satisfaction_score: avgRating?.avg_rating
          ? parseFloat(Number(avgRating.avg_rating).toFixed(2))
          : 0,
      },
      charts: {
        booking_trends: bookingTrend.map((d) => ({ date: d.date, count: parseInt(d.count || 0) })),
        revenue_trends: revenueTrend.map((d) => ({
          date: d.date,
          revenue: parseFloat(d.revenue || 0),
        })),
        user_registrations: registrationTrend.map((d) => ({
          date: d.date,
          count: parseInt(d.count || 0),
        })),
        provider_growth: providerGrowth.map((d) => ({
          date: d.date,
          count: parseInt(d.count || 0),
        })),
        cancellation_trends: cancellationTrend.map((d) => ({
          date: d.date,
          count: parseInt(d.count || 0),
        })),
        refund_trends: refundTrend.map((d) => ({
          date: d.date,
          amount: parseFloat(d.amount || 0),
        })),
        service_category_performance: categoryPerformance.map((s) => ({
          service_type: s.service_type,
          count: parseInt(s.count || 0),
          revenue: parseFloat(s.revenue || 0),
        })),
        customer_retention: retentionTrend,
      },
      date_range: { start, end },
    };
  });
}

async function getRetentionTrend(start, end) {
  const repeatCustomers = await db.sequelize.query(
    `SELECT DATE(b.created_at) AS date, COUNT(DISTINCT b.customer_id) AS returning_count
     FROM bookings b
     INNER JOIN (
       SELECT customer_id FROM bookings
       WHERE status = 'completed' AND customer_id IS NOT NULL
       GROUP BY customer_id HAVING COUNT(*) > 1
     ) r ON r.customer_id = b.customer_id
     WHERE b.created_at BETWEEN :start AND :end AND b.status != 'draft'
     GROUP BY DATE(b.created_at)
     ORDER BY date ASC`,
    { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
  );
  return repeatCustomers.map((r) => ({
    date: r.date,
    count: parseInt(r.returning_count || 0),
  }));
}

async function getLiveKpis() {
  const [
    activeServices,
    onlineProviders,
    pendingBookings,
    openDisputes,
    failedPayments,
  ] = await Promise.all([
    db.Booking.count({ where: { status: { [Op.in]: ACTIVE_STATUSES } } }),
    db.User.count({ where: { role: 'driver', status: 'active' } }),
    db.Booking.count({ where: { status: { [Op.in]: ['pending_payment', 'confirmed'] } } }),
    db.BookingDispute.count({ where: { status: { [Op.in]: ['open', 'investigating'] } } }),
    db.BookingTransaction.count({ where: { status: 'failed' } }),
  ]);

  return {
    active_services_now: activeServices,
    online_providers: onlineProviders,
    pending_bookings: pendingBookings,
    open_disputes: openDisputes,
    failed_payments: failedPayments,
    refreshed_at: new Date().toISOString(),
  };
}

async function getBookingAnalytics(query) {
  const { start, end } = parseDateRange(query);
  const where = bookingDateFilter(start, end);

  if (query.service_type) where.service_type = query.service_type;
  if (query.status) where.status = query.status;
  if (query.provider_id) where.provider_id = query.provider_id;

  const [
    byDate,
    byServiceType,
    byHour,
    statusBreakdown,
    durationStats,
    repeatRate,
  ] = await Promise.all([
    db.Booking.findAll({
      where,
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    db.Booking.findAll({
      where,
      attributes: ['service_type', [fn('COUNT', col('id')), 'count']],
      group: ['service_type'],
      raw: true,
    }),
    db.Booking.findAll({
      where,
      attributes: [[fn('HOUR', col('created_at')), 'hour'], [fn('COUNT', col('id')), 'count']],
      group: [fn('HOUR', col('created_at'))],
      order: [[fn('HOUR', col('created_at')), 'ASC']],
      raw: true,
    }),
    db.Booking.findAll({
      where,
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
    db.Booking.findAll({
      where: { ...where, status: 'completed', updated_at: { [Op.ne]: null } },
      attributes: [
        [fn('AVG', literal('TIMESTAMPDIFF(MINUTE, created_at, updated_at)')), 'avg_duration_minutes'],
      ],
      raw: true,
    }),
    db.sequelize.query(
      `SELECT
        COUNT(DISTINCT customer_id) AS total_customers,
        COUNT(DISTINCT CASE WHEN booking_count > 1 THEN customer_id END) AS repeat_customers
       FROM (
         SELECT customer_id, COUNT(*) AS booking_count
         FROM bookings
         WHERE created_at BETWEEN :start AND :end AND status != 'draft' AND customer_id IS NOT NULL
         GROUP BY customer_id
       ) t`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
  ]);

  const total = statusBreakdown.reduce((s, r) => s + parseInt(r.count || 0), 0);
  const completed = statusBreakdown.find((r) => r.status === 'completed');
  const cancelled = statusBreakdown.find((r) => r.status === 'cancelled');
  const completedCount = parseInt(completed?.count || 0);
  const cancelledCount = parseInt(cancelled?.count || 0);

  const repeat = repeatRate[0] || {};
  const totalCustomers = parseInt(repeat.total_customers || 0);
  const repeatCustomers = parseInt(repeat.repeat_customers || 0);

  return {
    summary: {
      total_bookings: total,
      completion_rate: total > 0 ? parseFloat(((completedCount / total) * 100).toFixed(1)) : 0,
      cancellation_rate: total > 0 ? parseFloat(((cancelledCount / total) * 100).toFixed(1)) : 0,
      average_service_duration_minutes: parseFloat(durationStats[0]?.avg_duration_minutes || 0),
      repeat_booking_rate:
        totalCustomers > 0
          ? parseFloat(((repeatCustomers / totalCustomers) * 100).toFixed(1))
          : 0,
    },
    by_date: byDate.map((d) => ({ date: d.date, count: parseInt(d.count || 0) })),
    by_service_type: byServiceType.map((s) => ({
      service_type: s.service_type,
      count: parseInt(s.count || 0),
    })),
    peak_hours: byHour.map((h) => ({ hour: parseInt(h.hour), count: parseInt(h.count || 0) })),
    by_status: statusBreakdown.map((s) => ({
      status: s.status,
      count: parseInt(s.count || 0),
    })),
    date_range: { start, end },
  };
}

async function getBookingHeatmap(query) {
  const { start, end } = parseDateRange(query);
  const where = bookingDateFilter(start, end);

  const geoPoints = await db.Booking.findAll({
    where: {
      ...where,
      service_latitude: { [Op.ne]: null },
      service_longitude: { [Op.ne]: null },
    },
    attributes: [
      'service_latitude',
      'service_longitude',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['service_latitude', 'service_longitude'],
    raw: true,
    limit: 500,
  });

  const hourlyHeat = await db.Booking.findAll({
    where,
    attributes: [
      [fn('DAYOFWEEK', col('created_at')), 'day_of_week'],
      [fn('HOUR', col('created_at')), 'hour'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DAYOFWEEK', col('created_at')), fn('HOUR', col('created_at'))],
    raw: true,
  });

  return {
    geographic: geoPoints.map((p) => ({
      lat: parseFloat(p.service_latitude),
      lng: parseFloat(p.service_longitude),
      count: parseInt(p.count || 0),
    })),
    time_heatmap: hourlyHeat.map((h) => ({
      day_of_week: parseInt(h.day_of_week),
      hour: parseInt(h.hour),
      count: parseInt(h.count || 0),
    })),
  };
}

async function getCustomerAnalytics(query) {
  const { start, end } = parseDateRange(query);

  const [
    activeCustomers,
    newRegistrations,
    returningCustomers,
    spendStats,
    topActive,
    topProfitable,
    satisfactionTrend,
    referralConversions,
  ] = await Promise.all([
    db.User.count({ where: { role: 'customer', status: 'active' } }),
    db.User.count({
      where: { role: 'customer', created_at: { [Op.between]: [start, end] } },
    }),
    db.sequelize.query(
      `SELECT COUNT(DISTINCT customer_id) AS count FROM bookings
       WHERE customer_id IN (
         SELECT id FROM users WHERE role = 'customer' AND created_at < :start
       ) AND created_at BETWEEN :start AND :end AND status = 'completed'`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.Booking.findAll({
      where: {
        status: 'completed',
        created_at: { [Op.between]: [start, end] },
        customer_id: { [Op.ne]: null },
      },
      attributes: [
        [fn('AVG', col('total_price')), 'avg_spend'],
        [fn('SUM', col('total_price')), 'total_spend'],
        [fn('COUNT', col('id')), 'booking_count'],
      ],
      raw: true,
    }),
    db.sequelize.query(
      `SELECT u.id, u.name, u.email, COUNT(b.id) AS booking_count
       FROM users u
       INNER JOIN bookings b ON b.customer_id = u.id
       WHERE u.role = 'customer' AND b.created_at BETWEEN :start AND :end AND b.status != 'draft'
       GROUP BY u.id ORDER BY booking_count DESC LIMIT 10`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.sequelize.query(
      `SELECT u.id, u.name, u.email, SUM(b.total_price) AS total_spent
       FROM users u
       INNER JOIN bookings b ON b.customer_id = u.id
       WHERE u.role = 'customer' AND b.status = 'completed' AND b.created_at BETWEEN :start AND :end
       GROUP BY u.id ORDER BY total_spent DESC LIMIT 10`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.Review.findAll({
      where: { created_at: { [Op.between]: [start, end] }, reviewer_role: 'customer' },
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('AVG', col('rating')), 'avg_rating']],
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    db.User.count({
      where: {
        role: 'customer',
        referral_share_count: { [Op.gt]: 0 },
        created_at: { [Op.between]: [start, end] },
      },
    }),
  ]);

  const spend = spendStats[0] || {};
  const totalCustomersInPeriod = await db.User.count({
    where: { role: 'customer', created_at: { [Op.lte]: end } },
  });
  const returning = parseInt(returningCustomers[0]?.count || 0);
  const retentionRate =
    totalCustomersInPeriod > 0
      ? parseFloat(((returning / totalCustomersInPeriod) * 100).toFixed(1))
      : 0;
  const churnRate = parseFloat((100 - retentionRate).toFixed(1));

  const ltvResult = await db.sequelize.query(
    `SELECT AVG(customer_total) AS ltv FROM (
      SELECT customer_id, SUM(total_price) AS customer_total
      FROM bookings WHERE status = 'completed' AND customer_id IS NOT NULL
      GROUP BY customer_id
    ) t`,
    { type: db.sequelize.QueryTypes.SELECT }
  );

  return {
    summary: {
      active_customers: activeCustomers,
      new_registrations: newRegistrations,
      returning_customers: returning,
      retention_rate: retentionRate,
      churn_rate: churnRate,
      average_customer_spend: parseFloat(spend.avg_spend || 0),
      lifetime_customer_value: parseFloat(ltvResult[0]?.ltv || 0),
      referral_conversions: referralConversions,
    },
    top_active_customers: topActive.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      booking_count: parseInt(c.booking_count),
    })),
    top_profitable_customers: topProfitable.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      total_spent: parseFloat(c.total_spent || 0),
    })),
    satisfaction_trends: satisfactionTrend.map((s) => ({
      date: s.date,
      avg_rating: parseFloat(Number(s.avg_rating || 0).toFixed(2)),
    })),
    date_range: { start, end },
  };
}

async function getCustomerRetention(query) {
  const { start, end } = parseDateRange(query);

  const cohorts = await db.sequelize.query(
    `SELECT DATE_FORMAT(u.created_at, '%Y-%m') AS cohort_month,
            COUNT(DISTINCT u.id) AS cohort_size,
            COUNT(DISTINCT CASE WHEN b.id IS NOT NULL THEN u.id END) AS retained
     FROM users u
     LEFT JOIN bookings b ON b.customer_id = u.id
       AND b.status = 'completed'
       AND b.created_at BETWEEN u.created_at AND DATE_ADD(u.created_at, INTERVAL 90 DAY)
     WHERE u.role = 'customer' AND u.created_at BETWEEN :start AND :end
     GROUP BY DATE_FORMAT(u.created_at, '%Y-%m')
     ORDER BY cohort_month ASC`,
    { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
  );

  const inactiveCustomers = await db.sequelize.query(
    `SELECT u.id, u.name, u.email, MAX(b.created_at) AS last_booking
     FROM users u
     LEFT JOIN bookings b ON b.customer_id = u.id AND b.status = 'completed'
     WHERE u.role = 'customer' AND u.status = 'active'
     GROUP BY u.id
     HAVING last_booking IS NULL OR last_booking < DATE_SUB(NOW(), INTERVAL 60 DAY)
     ORDER BY last_booking ASC
     LIMIT 50`,
    { type: db.sequelize.QueryTypes.SELECT }
  );

  return {
    cohorts: cohorts.map((c) => ({
      cohort_month: c.cohort_month,
      cohort_size: parseInt(c.cohort_size),
      retained: parseInt(c.retained),
      retention_rate:
        parseInt(c.cohort_size) > 0
          ? parseFloat(((parseInt(c.retained) / parseInt(c.cohort_size)) * 100).toFixed(1))
          : 0,
    })),
    inactive_customers: inactiveCustomers,
    date_range: { start, end },
  };
}

async function getProviderAnalytics(query) {
  const { start, end } = parseDateRange(query);

  const [
    activeProviders,
    avgRating,
    topProviders,
    lowProviders,
    earningsByProvider,
    completionRates,
  ] = await Promise.all([
    db.User.count({ where: { role: 'driver', status: 'active' } }),
    db.Review.findOne({
      where: { reviewee_role: 'driver' },
      attributes: [[fn('AVG', col('rating')), 'avg_rating']],
      raw: true,
    }),
    db.sequelize.query(
      `SELECT u.id, u.name, u.email,
              COUNT(b.id) AS completed_services,
              COALESCE(AVG(r.rating), 0) AS avg_rating,
              COALESCE(SUM(b.total_price - b.platform_fee), 0) AS earnings
       FROM users u
       LEFT JOIN bookings b ON b.assigned_driver_user_id = u.id
         AND b.status = 'completed' AND b.created_at BETWEEN :start AND :end
       LEFT JOIN reviews r ON r.reviewee_user_id = u.id AND r.reviewee_role = 'driver'
       WHERE u.role = 'driver'
       GROUP BY u.id
       ORDER BY completed_services DESC
       LIMIT 10`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.sequelize.query(
      `SELECT u.id, u.name, u.email,
              COUNT(b.id) AS completed_services,
              COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM users u
       LEFT JOIN bookings b ON b.assigned_driver_user_id = u.id
         AND b.status = 'completed' AND b.created_at BETWEEN :start AND :end
       LEFT JOIN reviews r ON r.reviewee_user_id = u.id AND r.reviewee_role = 'driver'
       WHERE u.role = 'driver'
       GROUP BY u.id
       HAVING completed_services > 0
       ORDER BY avg_rating ASC
       LIMIT 10`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.sequelize.query(
      `SELECT assigned_driver_user_id AS provider_id,
              SUM(total_price - platform_fee) AS earnings
       FROM bookings
       WHERE status = 'completed' AND assigned_driver_user_id IS NOT NULL
         AND created_at BETWEEN :start AND :end
       GROUP BY assigned_driver_user_id
       ORDER BY earnings DESC`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
    db.sequelize.query(
      `SELECT assigned_driver_user_id AS provider_id,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM bookings
       WHERE assigned_driver_user_id IS NOT NULL
         AND created_at BETWEEN :start AND :end AND status != 'draft'
       GROUP BY assigned_driver_user_id`,
      { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
    ),
  ]);

  const geoDistribution = await db.User.findAll({
    where: { role: 'driver', latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    attributes: ['id', 'name', 'latitude', 'longitude', 'status'],
    raw: true,
    limit: 500,
  });

  return {
    summary: {
      active_providers: activeProviders,
      average_provider_rating: avgRating?.avg_rating
        ? parseFloat(Number(avgRating.avg_rating).toFixed(2))
        : 0,
    },
    top_performers: topProviders.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      completed_services: parseInt(p.completed_services),
      avg_rating: parseFloat(Number(p.avg_rating).toFixed(2)),
      earnings: parseFloat(p.earnings || 0),
    })),
    low_performers: lowProviders.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      completed_services: parseInt(p.completed_services),
      avg_rating: parseFloat(Number(p.avg_rating).toFixed(2)),
    })),
    earnings: earningsByProvider.map((e) => ({
      provider_id: e.provider_id,
      earnings: parseFloat(e.earnings || 0),
    })),
    completion_rates: completionRates.map((c) => ({
      provider_id: c.provider_id,
      total: parseInt(c.total),
      completed: parseInt(c.completed),
      cancelled: parseInt(c.cancelled),
      completion_rate:
        parseInt(c.total) > 0
          ? parseFloat(((parseInt(c.completed) / parseInt(c.total)) * 100).toFixed(1))
          : 0,
    })),
    geographic_distribution: geoDistribution.map((p) => ({
      id: p.id,
      name: p.name,
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      status: p.status,
    })),
    date_range: { start, end },
  };
}

async function getProviderComparison(query) {
  const { start, end } = parseDateRange(query);
  const providerIds = (query.provider_ids || '')
    .split(',')
    .map((id) => parseInt(id.trim()))
    .filter((id) => !Number.isNaN(id));

  if (!providerIds.length) {
    return { providers: [], date_range: { start, end } };
  }

  const providers = await db.sequelize.query(
    `SELECT u.id, u.name,
            COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_price ELSE 0 END), 0) AS revenue,
            COALESCE(AVG(r.rating), 0) AS avg_rating,
            COUNT(b.id) AS service_volume,
            SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
            COALESCE(AVG(TIMESTAMPDIFF(MINUTE, b.created_at, b.updated_at)), 0) AS avg_completion_minutes,
            (SELECT COUNT(*) FROM provider_flags pf WHERE pf.provider_id = u.id AND pf.resolved = 0) AS complaint_count
     FROM users u
     LEFT JOIN bookings b ON b.assigned_driver_user_id = u.id
       AND b.created_at BETWEEN :start AND :end AND b.status != 'draft'
     LEFT JOIN reviews r ON r.reviewee_user_id = u.id AND r.reviewee_role = 'driver'
     WHERE u.id IN (:providerIds) AND u.role = 'driver'
     GROUP BY u.id`,
    {
      replacements: { start, end, providerIds },
      type: db.sequelize.QueryTypes.SELECT,
    }
  );

  return {
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      revenue: parseFloat(p.revenue || 0),
      avg_rating: parseFloat(Number(p.avg_rating).toFixed(2)),
      service_volume: parseInt(p.service_volume),
      completion_rate:
        parseInt(p.service_volume) > 0
          ? parseFloat(((parseInt(p.completed_count) / parseInt(p.service_volume)) * 100).toFixed(1))
          : 0,
      avg_completion_minutes: parseFloat(p.avg_completion_minutes || 0),
      complaint_count: parseInt(p.complaint_count || 0),
    })),
    date_range: { start, end },
  };
}

async function getSatisfactionAnalytics(query) {
  const { start, end } = parseDateRange(query);

  const [
    ratingStats,
    reviewTrend,
    positiveNegative,
    complaintRate,
    refundRate,
  ] = await Promise.all([
    db.Review.findAll({
      where: { created_at: { [Op.between]: [start, end] } },
      attributes: [
        [fn('AVG', col('rating')), 'avg_rating'],
        [fn('COUNT', col('id')), 'total_reviews'],
        [fn('SUM', literal('CASE WHEN is_satisfied = 1 THEN 1 ELSE 0 END')), 'satisfied_count'],
      ],
      raw: true,
    }),
    db.Review.findAll({
      where: { created_at: { [Op.between]: [start, end] } },
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        [fn('AVG', col('rating')), 'avg_rating'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    db.Review.findAll({
      where: { created_at: { [Op.between]: [start, end] } },
      attributes: [
        [literal('CASE WHEN rating >= 4 THEN "positive" WHEN rating <= 2 THEN "negative" ELSE "neutral" END'), 'sentiment'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [literal('CASE WHEN rating >= 4 THEN "positive" WHEN rating <= 2 THEN "negative" ELSE "neutral" END')],
      raw: true,
    }),
    db.PlatformReport.count({
      where: { created_at: { [Op.between]: [start, end] } },
    }),
    db.Booking.findAll({
      where: {
        status: { [Op.in]: COMPLETED_STATUSES },
        created_at: { [Op.between]: [start, end] },
      },
      attributes: [
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal('CASE WHEN refund_amount > 0 THEN 1 ELSE 0 END')), 'refunded'],
      ],
      raw: true,
    }),
  ]);

  const stats = ratingStats[0] || {};
  const totalReviews = parseInt(stats.total_reviews || 0);
  const satisfiedCount = parseInt(stats.satisfied_count || 0);
  const refund = refundRate[0] || {};
  const totalBookings = parseInt(refund.total || 0);
  const refundedBookings = parseInt(refund.refunded || 0);

  const commonIssues = await db.PlatformReport.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: ['report_type', [fn('COUNT', col('id')), 'count']],
    group: ['report_type'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 10,
    raw: true,
  });

  const positiveCount = parseInt(
    positiveNegative.find((p) => p.sentiment === 'positive')?.count || 0
  );
  const negativeCount = parseInt(
    positiveNegative.find((p) => p.sentiment === 'negative')?.count || 0
  );
  const npsProxy =
    totalReviews > 0
      ? parseFloat((((positiveCount - negativeCount) / totalReviews) * 100).toFixed(1))
      : 0;

  return {
    summary: {
      average_rating: parseFloat(Number(stats.avg_rating || 0).toFixed(2)),
      total_reviews: totalReviews,
      satisfaction_rate:
        totalReviews > 0 ? parseFloat(((satisfiedCount / totalReviews) * 100).toFixed(1)) : 0,
      complaint_rate: totalBookings > 0 ? parseFloat(((complaintRate / totalBookings) * 100).toFixed(2)) : 0,
      refund_percentage:
        totalBookings > 0
          ? parseFloat(((refundedBookings / totalBookings) * 100).toFixed(1))
          : 0,
      nps_proxy: npsProxy,
    },
    rating_trends: reviewTrend.map((r) => ({
      date: r.date,
      avg_rating: parseFloat(Number(r.avg_rating || 0).toFixed(2)),
      count: parseInt(r.count || 0),
    })),
    sentiment_breakdown: positiveNegative.map((s) => ({
      sentiment: s.sentiment,
      count: parseInt(s.count || 0),
    })),
    common_issues: commonIssues.map((i) => ({
      report_type: i.report_type,
      count: parseInt(i.count || 0),
    })),
    date_range: { start, end },
  };
}

module.exports = {
  getDashboard,
  getLiveKpis,
  getBookingAnalytics,
  getBookingHeatmap,
  getRevenueReport,
  getRefundReport,
  getCustomerAnalytics,
  getCustomerRetention,
  getProviderAnalytics,
  getProviderComparison,
  getSatisfactionAnalytics,
};
