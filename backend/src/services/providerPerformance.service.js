const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const settings = await getThresholdSettings();

  const [
    totalActive,
    avgRatingResult,
    totalCompletedServices,
    totalVacuumPenalties,
  ] = await Promise.all([
    db.User.count({ where: { role: 'driver', status: 'active' } }),
    db.Review.findOne({
      where: { reviewee_role: 'driver' },
      attributes: [[fn('AVG', col('rating')), 'avg_rating']],
      raw: true,
    }),
    db.Booking.count({ where: { status: 'completed' } }),
    db.VacuumPenalty.count({ where: { status: { [Op.ne]: 'reversed' } } }),
  ]);

  const lowRatingProviders = await getLowRatingProviderCount(settings.min_rating_threshold);

  const flaggedThisWeek = await db.ProviderFlag.count({
    where: { created_at: { [Op.gte]: weekAgo }, resolved: false },
    col: 'provider_id',
    distinct: true,
  });

  const atLimitCount = await getProvidersAtLimitCount();

  return {
    total_active_providers: totalActive,
    providers_below_rating: lowRatingProviders,
    providers_flagged_this_week: flaggedThisWeek,
    average_provider_rating: avgRatingResult?.avg_rating
      ? parseFloat(Number(avgRatingResult.avg_rating).toFixed(2))
      : 0,
    total_completed_services: totalCompletedServices,
    total_vacuum_penalties: totalVacuumPenalties,
    providers_at_service_limit: atLimitCount,
  };
}

async function getLowRatingProviderCount(threshold) {
  const result = await db.Review.findAll({
    where: { reviewee_role: 'driver' },
    attributes: [
      'reviewee_user_id',
      [fn('AVG', col('rating')), 'avg_rating'],
    ],
    group: ['reviewee_user_id'],
    having: literal(`AVG(rating) < ${parseFloat(threshold) || 3.0}`),
    raw: true,
  });
  return result.length;
}

async function getProvidersAtLimitCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const providers = await db.User.findAll({
    where: { role: 'driver', service_limit_enabled: true, daily_service_limit: { [Op.gt]: 0 } },
    attributes: ['id', 'daily_service_limit'],
    raw: true,
  });

  if (!providers.length) return 0;

  const todayCounts = await db.Booking.findAll({
    where: {
      assigned_driver_user_id: { [Op.in]: providers.map((p) => p.id) },
      status: 'completed',
      updated_at: { [Op.gte]: today, [Op.lt]: tomorrow },
    },
    attributes: [
      'assigned_driver_user_id',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['assigned_driver_user_id'],
    raw: true,
  });

  const countMap = {};
  for (const row of todayCounts) {
    countMap[row.assigned_driver_user_id] = parseInt(row.count);
  }

  return providers.filter((p) => (countMap[p.id] || 0) >= p.daily_service_limit).length;
}

async function listProviderPerformance(params = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    sort = 'created_at',
    order = 'desc',
    filter,
    min_rating,
    max_rating,
    city,
    state,
  } = params;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const userWhere = { role: 'driver' };

  if (search) {
    userWhere[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  if (filter === 'suspended') {
    userWhere.status = 'suspended';
  }

  const { count, rows } = await db.User.findAndCountAll({
    where: userWhere,
    attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry', 'social_token', 'social_id'] },
    include: [
      {
        model: db.DriverProfile,
        as: 'driver_profile',
        attributes: ['id', 'profile_picture', 'approval_status', 'is_completed'],
      },
    ],
    order: [[sort === 'name' ? 'name' : 'created_at', order === 'asc' ? 'ASC' : 'DESC']],
    limit: limitNum,
    offset,
    distinct: true,
  });

  const providerIds = rows.map((u) => u.id);

  if (!providerIds.length) {
    return {
      providers: [],
      pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [bookingStats, ratingStats, cancelStats, complaintStats, vacuumStats, todayServiceCounts, flagCounts] = await Promise.all([
    db.Booking.findAll({
      where: { assigned_driver_user_id: { [Op.in]: providerIds }, status: { [Op.ne]: 'draft' } },
      attributes: [
        'assigned_driver_user_id',
        [fn('COUNT', col('id')), 'total_services'],
        [fn('SUM', literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed'],
        [fn('SUM', literal("CASE WHEN status = 'completed' THEN COALESCE(total_price, 0) ELSE 0 END")), 'total_earnings'],
        [fn('SUM', literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled'],
      ],
      group: ['assigned_driver_user_id'],
      raw: true,
    }),
    db.Review.findAll({
      where: { reviewee_user_id: { [Op.in]: providerIds } },
      attributes: [
        'reviewee_user_id',
        [fn('AVG', col('rating')), 'avg_rating'],
        [fn('COUNT', col('id')), 'total_reviews'],
      ],
      group: ['reviewee_user_id'],
      raw: true,
    }),
    db.Booking.findAll({
      where: { assigned_driver_user_id: { [Op.in]: providerIds }, status: 'cancelled' },
      attributes: [
        'assigned_driver_user_id',
        [fn('COUNT', col('id')), 'cancellation_count'],
      ],
      group: ['assigned_driver_user_id'],
      raw: true,
    }),
    db.BookingDispute.findAll({
      include: [{
        model: db.Booking,
        as: 'booking',
        attributes: [],
        where: { assigned_driver_user_id: { [Op.in]: providerIds } },
      }],
      attributes: [
        [col('booking.assigned_driver_user_id'), 'provider_id'],
        [fn('COUNT', col('BookingDispute.id')), 'complaint_count'],
      ],
      group: [col('booking.assigned_driver_user_id')],
      raw: true,
    }),
    db.VacuumPenalty.findAll({
      where: { provider_id: { [Op.in]: providerIds }, status: { [Op.ne]: 'reversed' } },
      attributes: [
        'provider_id',
        [fn('COUNT', col('id')), 'penalty_count'],
      ],
      group: ['provider_id'],
      raw: true,
    }),
    db.Booking.findAll({
      where: {
        assigned_driver_user_id: { [Op.in]: providerIds },
        status: 'completed',
        updated_at: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
      attributes: [
        'assigned_driver_user_id',
        [fn('COUNT', col('id')), 'today_count'],
      ],
      group: ['assigned_driver_user_id'],
      raw: true,
    }),
    db.ProviderFlag.findAll({
      where: { provider_id: { [Op.in]: providerIds }, resolved: false },
      attributes: [
        'provider_id',
        [fn('COUNT', col('id')), 'flag_count'],
      ],
      group: ['provider_id'],
      raw: true,
    }),
  ]);

  const bookingMap = mapByKey(bookingStats, 'assigned_driver_user_id');
  const ratingMap = mapByKey(ratingStats, 'reviewee_user_id');
  const cancelMap = mapByKey(cancelStats, 'assigned_driver_user_id');
  const complaintMap = mapByKey(complaintStats, 'provider_id');
  const vacuumMap = mapByKey(vacuumStats, 'provider_id');
  const todayMap = mapByKey(todayServiceCounts, 'assigned_driver_user_id');
  const flagMap = mapByKey(flagCounts, 'provider_id');

  let providers = rows.map((user) => {
    const u = user.toJSON();
    const booking = bookingMap[u.id] || {};
    const rating = ratingMap[u.id] || {};
    const totalServices = parseInt(booking.total_services || 0);
    const cancelled = parseInt(booking.cancelled || 0);
    const cancellationRate = totalServices > 0 ? ((cancelled / totalServices) * 100).toFixed(1) : '0.0';

    return {
      ...u,
      avg_rating: rating.avg_rating ? parseFloat(Number(rating.avg_rating).toFixed(1)) : null,
      total_reviews: parseInt(rating.total_reviews || 0),
      completed_services: parseInt(booking.completed || 0),
      total_earnings: parseFloat(booking.total_earnings || 0).toFixed(2),
      cancellation_rate: cancellationRate,
      vacuum_penalties: parseInt(vacuumMap[u.id]?.penalty_count || 0),
      complaints_count: parseInt(complaintMap[u.id]?.complaint_count || 0),
      today_completed: parseInt(todayMap[u.id]?.today_count || 0),
      active_flags: parseInt(flagMap[u.id]?.flag_count || 0),
    };
  });

  if (filter === 'low_rating') {
    providers = providers.filter((p) => p.avg_rating !== null && p.avg_rating < 3.0);
  } else if (filter === 'high_complaints') {
    providers = providers.filter((p) => p.complaints_count >= 3);
  } else if (filter === 'high_cancellations') {
    providers = providers.filter((p) => parseFloat(p.cancellation_rate) > 20);
  } else if (filter === 'top_earners') {
    providers.sort((a, b) => parseFloat(b.total_earnings) - parseFloat(a.total_earnings));
  }

  if (min_rating) {
    providers = providers.filter((p) => p.avg_rating !== null && p.avg_rating >= parseFloat(min_rating));
  }
  if (max_rating) {
    providers = providers.filter((p) => p.avg_rating !== null && p.avg_rating <= parseFloat(max_rating));
  }

  return {
    providers,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(count / limitNum),
    },
  };
}

async function getProviderPerformanceDetail(providerId) {
  const user = await db.User.findOne({
    where: { id: providerId, role: 'driver' },
    attributes: { exclude: ['password', 'token_version', 'otp_code', 'otp_expiry', 'social_token', 'social_id'] },
    include: [
      { model: db.DriverProfile, as: 'driver_profile' },
    ],
  });

  if (!user) return null;

  const [bookings, reviews, disputes, vacuumPenalties, flags] = await Promise.all([
    db.Booking.findAll({
      where: { assigned_driver_user_id: providerId, status: { [Op.ne]: 'draft' } },
      attributes: ['id', 'booking_code', 'status', 'total_price', 'created_at', 'updated_at', 'cancelled_at'],
      order: [['created_at', 'DESC']],
    }),
    db.Review.findAll({
      where: { reviewee_user_id: providerId },
      include: [
        { model: db.User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
        { model: db.ReviewImage, as: 'images' },
        { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      ],
      order: [['created_at', 'DESC']],
    }),
    db.BookingDispute.findAll({
      include: [{
        model: db.Booking,
        as: 'booking',
        attributes: ['id', 'booking_code'],
        where: { assigned_driver_user_id: providerId },
      }],
      order: [['created_at', 'DESC']],
    }),
    db.VacuumPenalty.findAll({
      where: { provider_id: providerId },
      include: [
        { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
        { model: db.User, as: 'issuer', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    }),
    db.ProviderFlag.findAll({
      where: { provider_id: providerId },
      include: [
        { model: db.User, as: 'resolver', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    }),
  ]);

  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
  const totalEarnings = completedBookings.reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / reviews.length
    : null;

  const refundCount = await db.RefundRequest.count({
    where: { status: 'refunded' },
    include: [{
      model: db.Booking,
      as: 'booking',
      attributes: [],
      where: { assigned_driver_user_id: providerId },
    }],
  });

  const satisfiedReviews = reviews.filter((r) => r.is_satisfied === true).length;

  const metrics = {
    avg_rating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
    total_completed_services: completedBookings.length,
    total_cancelled_services: cancelledBookings.length,
    completion_rate: bookings.length > 0
      ? parseFloat(((completedBookings.length / bookings.length) * 100).toFixed(1))
      : 0,
    total_earnings: parseFloat(totalEarnings.toFixed(2)),
    complaint_count: disputes.length,
    complaint_ratio: bookings.length > 0
      ? parseFloat(((disputes.length / bookings.length) * 100).toFixed(1))
      : 0,
    refund_count: refundCount,
    refund_ratio: bookings.length > 0
      ? parseFloat(((refundCount / bookings.length) * 100).toFixed(1))
      : 0,
    satisfaction_score: reviews.length > 0
      ? parseFloat(((satisfiedReviews / reviews.length) * 100).toFixed(1))
      : 0,
    total_reviews: reviews.length,
    vacuum_penalty_count: vacuumPenalties.filter((p) => p.status !== 'reversed').length,
    vacuum_penalty_total: vacuumPenalties
      .filter((p) => p.status !== 'reversed')
      .reduce((s, p) => s + parseFloat(p.penalty_amount || 0), 0),
  };

  return {
    user: user.toJSON(),
    metrics,
    reviews: reviews.map((r) => r.toJSON()),
    disputes: disputes.map((d) => d.toJSON()),
    vacuum_penalties: vacuumPenalties.map((p) => p.toJSON()),
    flags: flags.map((f) => f.toJSON()),
  };
}

async function getPerformanceCharts(providerId, period = 'monthly') {
  const monthsBack = period === 'weekly' ? 3 : period === 'daily' ? 1 : 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const dateFormat = period === 'daily' ? '%Y-%m-%d' : period === 'weekly' ? '%Y-%u' : '%Y-%m';

  const [earningsTrend, ratingsTrend, completionTrend, complaintTrend] = await Promise.all([
    db.Booking.findAll({
      where: {
        assigned_driver_user_id: providerId,
        status: 'completed',
        created_at: { [Op.gte]: startDate },
      },
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), dateFormat), 'date'],
        [fn('SUM', col('total_price')), 'earnings'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [literal(`DATE_FORMAT(created_at, '${dateFormat}')`)],
      order: [[literal(`DATE_FORMAT(created_at, '${dateFormat}')`), 'ASC']],
      raw: true,
    }),
    db.Review.findAll({
      where: {
        reviewee_user_id: providerId,
        created_at: { [Op.gte]: startDate },
      },
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), dateFormat), 'date'],
        [fn('AVG', col('rating')), 'avg_rating'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [literal(`DATE_FORMAT(created_at, '${dateFormat}')`)],
      order: [[literal(`DATE_FORMAT(created_at, '${dateFormat}')`), 'ASC']],
      raw: true,
    }),
    db.Booking.findAll({
      where: {
        assigned_driver_user_id: providerId,
        status: { [Op.in]: ['completed', 'cancelled'] },
        created_at: { [Op.gte]: startDate },
      },
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), dateFormat), 'date'],
        [fn('SUM', literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed'],
        [fn('SUM', literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled'],
      ],
      group: [literal(`DATE_FORMAT(created_at, '${dateFormat}')`)],
      order: [[literal(`DATE_FORMAT(created_at, '${dateFormat}')`), 'ASC']],
      raw: true,
    }),
    db.BookingDispute.findAll({
      include: [{
        model: db.Booking,
        as: 'booking',
        attributes: [],
        where: { assigned_driver_user_id: providerId },
      }],
      where: { created_at: { [Op.gte]: startDate } },
      attributes: [
        [fn('DATE_FORMAT', col('BookingDispute.created_at'), dateFormat), 'date'],
        [fn('COUNT', col('BookingDispute.id')), 'count'],
      ],
      group: [literal(`DATE_FORMAT(BookingDispute.created_at, '${dateFormat}')`)],
      order: [[literal(`DATE_FORMAT(BookingDispute.created_at, '${dateFormat}')`), 'ASC']],
      raw: true,
    }),
  ]);

  return {
    earnings_trend: earningsTrend.map((r) => ({
      date: r.date,
      earnings: parseFloat(r.earnings || 0),
      services: parseInt(r.count || 0),
    })),
    ratings_trend: ratingsTrend.map((r) => ({
      date: r.date,
      avg_rating: parseFloat(Number(r.avg_rating || 0).toFixed(1)),
      count: parseInt(r.count || 0),
    })),
    completion_trend: completionTrend.map((r) => ({
      date: r.date,
      completed: parseInt(r.completed || 0),
      cancelled: parseInt(r.cancelled || 0),
    })),
    complaint_trend: complaintTrend.map((r) => ({
      date: r.date,
      count: parseInt(r.count || 0),
    })),
  };
}

async function exportProvidersCsv(params = {}) {
  const result = await listProviderPerformance({ ...params, limit: 10000 });
  const headers = [
    'ID', 'Name', 'Email', 'Phone', 'Rating', 'Reviews', 'Completed Services',
    'Cancellation Rate', 'Earnings', 'Vacuum Penalties', 'Complaints', 'Status',
  ];

  const csvRows = [headers.join(',')];
  for (const p of result.providers) {
    csvRows.push([
      p.id,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.email,
      p.phone || '',
      p.avg_rating || 'N/A',
      p.total_reviews,
      p.completed_services,
      `${p.cancellation_rate}%`,
      `$${p.total_earnings}`,
      p.vacuum_penalties,
      p.complaints_count,
      p.status,
    ].join(','));
  }

  return csvRows.join('\n');
}

async function runAutomatedFlagging() {
  const settings = await getThresholdSettings();
  const providers = await db.User.findAll({
    where: { role: 'driver', status: 'active' },
    attributes: ['id'],
    raw: true,
  });

  const providerIds = providers.map((p) => p.id);
  if (!providerIds.length) return { flagged: 0 };

  const [ratingStats, cancellationStats, complaintStats, disputeStats] = await Promise.all([
    db.Review.findAll({
      where: { reviewee_user_id: { [Op.in]: providerIds } },
      attributes: [
        'reviewee_user_id',
        [fn('AVG', col('rating')), 'avg_rating'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['reviewee_user_id'],
      having: literal(`COUNT(id) >= 3`),
      raw: true,
    }),
    db.Booking.findAll({
      where: { assigned_driver_user_id: { [Op.in]: providerIds }, status: { [Op.ne]: 'draft' } },
      attributes: [
        'assigned_driver_user_id',
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled'],
      ],
      group: ['assigned_driver_user_id'],
      having: literal(`COUNT(id) >= 5`),
      raw: true,
    }),
    db.BookingDispute.findAll({
      include: [{
        model: db.Booking,
        as: 'booking',
        attributes: [],
        where: { assigned_driver_user_id: { [Op.in]: providerIds } },
      }],
      attributes: [
        [col('booking.assigned_driver_user_id'), 'provider_id'],
        [fn('COUNT', col('BookingDispute.id')), 'count'],
      ],
      group: [col('booking.assigned_driver_user_id')],
      raw: true,
    }),
    db.BookingDispute.findAll({
      where: { status: { [Op.in]: ['open', 'investigating'] } },
      include: [{
        model: db.Booking,
        as: 'booking',
        attributes: [],
        where: { assigned_driver_user_id: { [Op.in]: providerIds } },
      }],
      attributes: [
        [col('booking.assigned_driver_user_id'), 'provider_id'],
        [fn('COUNT', col('BookingDispute.id')), 'count'],
      ],
      group: [col('booking.assigned_driver_user_id')],
      raw: true,
    }),
  ]);

  let flagged = 0;

  for (const r of ratingStats) {
    const avgRating = parseFloat(r.avg_rating);
    if (avgRating < parseFloat(settings.min_rating_threshold)) {
      await createFlagIfNotExists(r.reviewee_user_id, 'low_rating', {
        avg_rating: avgRating,
        threshold: settings.min_rating_threshold,
        review_count: parseInt(r.count),
      });
      flagged++;
    }
  }

  for (const r of cancellationStats) {
    const rate = (parseInt(r.cancelled) / parseInt(r.total)) * 100;
    if (rate > parseFloat(settings.max_cancellation_rate)) {
      await createFlagIfNotExists(r.assigned_driver_user_id, 'high_cancellation', {
        cancellation_rate: rate.toFixed(1),
        threshold: settings.max_cancellation_rate,
      });
      flagged++;
    }
  }

  for (const r of complaintStats) {
    if (parseInt(r.count) >= parseInt(settings.max_complaint_count)) {
      await createFlagIfNotExists(r.provider_id, 'high_complaints', {
        complaint_count: parseInt(r.count),
        threshold: settings.max_complaint_count,
      });
      flagged++;
    }
  }

  for (const r of disputeStats) {
    if (parseInt(r.count) >= parseInt(settings.max_open_disputes)) {
      await createFlagIfNotExists(r.provider_id, 'excessive_disputes', {
        open_dispute_count: parseInt(r.count),
        threshold: settings.max_open_disputes,
      });
      flagged++;
    }
  }

  return { flagged };
}

async function createFlagIfNotExists(providerId, flagType, details) {
  const existing = await db.ProviderFlag.findOne({
    where: { provider_id: providerId, flag_type: flagType, resolved: false },
  });
  if (existing) return existing;

  return db.ProviderFlag.create({
    provider_id: providerId,
    flag_type: flagType,
    severity: flagType === 'excessive_disputes' ? 'critical' : 'warning',
    details,
    flagged_by: 'system',
  });
}

async function resolveFlag(flagId, adminId, note) {
  const flag = await db.ProviderFlag.findByPk(flagId);
  if (!flag) return null;

  await flag.update({
    resolved: true,
    resolved_by: adminId,
    resolved_at: new Date(),
    resolution_note: note || null,
  });

  return flag;
}

async function getThresholdSettings() {
  const keys = [
    'provider_min_rating_threshold',
    'provider_max_cancellation_rate',
    'provider_max_complaint_count',
    'provider_max_open_disputes',
    'provider_default_daily_limit',
  ];

  const settings = await db.AppSetting.findAll({
    where: { key: { [Op.in]: keys } },
    attributes: ['key', 'value'],
    raw: true,
  });

  const map = {};
  for (const s of settings) map[s.key] = s.value;

  return {
    min_rating_threshold: map.provider_min_rating_threshold || '3.0',
    max_cancellation_rate: map.provider_max_cancellation_rate || '20',
    max_complaint_count: map.provider_max_complaint_count || '5',
    max_open_disputes: map.provider_max_open_disputes || '3',
    default_daily_limit: map.provider_default_daily_limit || '4',
  };
}

function mapByKey(arr, key) {
  const map = {};
  for (const item of arr) map[item[key]] = item;
  return map;
}

async function createManualFlag({ providerId, flagType, severity, notes, adminId, ipAddress }) {
  const user = await db.User.findOne({ where: { id: providerId, role: 'driver' } });
  if (!user) throw new Error('Provider not found');

  const flag = await db.ProviderFlag.create({
    provider_id: providerId,
    flag_type: flagType,
    severity: severity || 'warning',
    flagged_by: 'admin',
    details: notes ? { admin_notes: notes } : null,
    resolved: false,
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action: 'provider_manually_flagged',
    target_type: 'user',
    target_id: providerId,
    details: { flag_type: flagType, severity, notes },
    ip_address: ipAddress,
  }).catch(() => {});

  return flag;
}

module.exports = {
  getDashboardStats,
  listProviderPerformance,
  getProviderPerformanceDetail,
  getPerformanceCharts,
  exportProvidersCsv,
  runAutomatedFlagging,
  resolveFlag,
  getThresholdSettings,
  createManualFlag,
};
