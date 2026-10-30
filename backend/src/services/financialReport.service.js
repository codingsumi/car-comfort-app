const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');

function parseDateRange(query) {
  const { from_date, to_date, period } = query;
  const now = new Date();
  let start, end;

  if (from_date && to_date) {
    start = new Date(from_date);
    end = new Date(to_date);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'daily') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

async function getRevenueReport(query) {
  const { start, end } = parseDateRange(query);
  const { service_type, provider_id } = query;

  const bookingWhere = {
    status: { [Op.in]: ['completed', 'refunded'] },
    created_at: { [Op.between]: [start, end] },
  };

  if (service_type) bookingWhere.service_type = service_type;
  if (provider_id) bookingWhere.assigned_driver_user_id = provider_id;

  const [totals] = await db.Booking.findAll({
    where: bookingWhere,
    attributes: [
      [fn('SUM', col('total_price')), 'gross_revenue'],
      [fn('SUM', col('platform_fee')), 'platform_commission'],
      [fn('SUM', col('service_fee')), 'service_fees'],
      [fn('SUM', col('tax')), 'taxes_collected'],
      [fn('SUM', col('refund_amount')), 'total_refunds'],
      [fn('COUNT', col('id')), 'total_bookings'],
    ],
    raw: true,
  });

  const grossRevenue = parseFloat(totals?.gross_revenue || 0);
  const totalRefunds = parseFloat(totals?.total_refunds || 0);
  const platformCommission = parseFloat(totals?.platform_commission || 0);
  const serviceFees = parseFloat(totals?.service_fees || 0);
  const taxesCollected = parseFloat(totals?.taxes_collected || 0);

  const netRevenue = grossRevenue - totalRefunds;
  const commissionEarned = platformCommission + serviceFees;

  const [pendingPayouts, paidPayouts] = await Promise.all([
    db.ProviderPayout.sum('net_amount', { where: { status: 'pending' } }),
    db.ProviderPayout.sum('net_amount', { where: { status: 'paid' } }),
  ]);

  const trendData = await db.Booking.findAll({
    where: bookingWhere,
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('SUM', col('total_price')), 'revenue'],
      [fn('SUM', col('refund_amount')), 'refunds'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  const byServiceType = await db.Booking.findAll({
    where: bookingWhere,
    attributes: [
      'service_type',
      [fn('SUM', col('total_price')), 'revenue'],
      [fn('SUM', col('refund_amount')), 'refunds'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['service_type'],
    order: [[fn('SUM', col('total_price')), 'DESC']],
    raw: true,
  });

  return {
    summary: {
      gross_revenue: grossRevenue,
      net_revenue: parseFloat(netRevenue.toFixed(2)),
      commission_earned: parseFloat(commissionEarned.toFixed(2)),
      taxes_collected: taxesCollected,
      total_refunds: totalRefunds,
      pending_payouts: parseFloat(pendingPayouts || 0),
      paid_payouts: parseFloat(paidPayouts || 0),
      total_bookings: parseInt(totals?.total_bookings || 0),
    },
    trend: trendData.map((d) => ({
      date: d.date,
      revenue: parseFloat(d.revenue || 0),
      refunds: parseFloat(d.refunds || 0),
      count: parseInt(d.count || 0),
    })),
    by_service_type: byServiceType.map((s) => ({
      service_type: s.service_type,
      revenue: parseFloat(s.revenue || 0),
      refunds: parseFloat(s.refunds || 0),
      count: parseInt(s.count || 0),
    })),
  };
}

async function getRefundReport(query) {
  const { start, end } = parseDateRange(query);

  const [totals] = await db.RefundRequest.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      [fn('SUM', col('amount')), 'total_refunded'],
      [fn('COUNT', col('id')), 'total_requests'],
    ],
    raw: true,
  });

  const byStatus = await db.RefundRequest.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      'status',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('amount')), 'total'],
    ],
    group: ['status'],
    raw: true,
  });

  const trend = await db.RefundRequest.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('SUM', col('amount')), 'amount'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  return {
    summary: {
      total_refunded: parseFloat(totals?.total_refunded || 0),
      total_requests: parseInt(totals?.total_requests || 0),
    },
    by_status: byStatus.map((s) => ({
      status: s.status,
      count: parseInt(s.count || 0),
      total: parseFloat(s.total || 0),
    })),
    trend: trend.map((d) => ({
      date: d.date,
      amount: parseFloat(d.amount || 0),
      count: parseInt(d.count || 0),
    })),
  };
}

async function getPayoutReport(query) {
  const { start, end } = parseDateRange(query);

  const [totals] = await db.ProviderPayout.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      [fn('SUM', col('net_amount')), 'total_paid'],
      [fn('SUM', col('commission_deducted')), 'total_commission'],
      [fn('COUNT', col('id')), 'total_payouts'],
    ],
    raw: true,
  });

  const byStatus = await db.ProviderPayout.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      'status',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('net_amount')), 'total'],
    ],
    group: ['status'],
    raw: true,
  });

  const trend = await db.ProviderPayout.findAll({
    where: { created_at: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('SUM', col('net_amount')), 'amount'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  return {
    summary: {
      total_paid: parseFloat(totals?.total_paid || 0),
      total_commission: parseFloat(totals?.total_commission || 0),
      total_payouts: parseInt(totals?.total_payouts || 0),
    },
    by_status: byStatus.map((s) => ({
      status: s.status,
      count: parseInt(s.count || 0),
      total: parseFloat(s.total || 0),
    })),
    trend: trend.map((d) => ({
      date: d.date,
      amount: parseFloat(d.amount || 0),
      count: parseInt(d.count || 0),
    })),
  };
}

async function getTaxReport(query) {
  const { start, end } = parseDateRange(query);

  const [totals] = await db.Booking.findAll({
    where: {
      status: { [Op.in]: ['completed', 'refunded'] },
      created_at: { [Op.between]: [start, end] },
    },
    attributes: [
      [fn('SUM', col('tax')), 'total_tax'],
      [fn('COUNT', col('id')), 'total_bookings'],
    ],
    raw: true,
  });

  const byServiceType = await db.Booking.findAll({
    where: {
      status: { [Op.in]: ['completed', 'refunded'] },
      created_at: { [Op.between]: [start, end] },
    },
    attributes: [
      'service_type',
      [fn('SUM', col('tax')), 'tax_collected'],
      [fn('SUM', col('total_price')), 'revenue'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['service_type'],
    raw: true,
  });

  return {
    summary: {
      total_tax: parseFloat(totals?.total_tax || 0),
      total_bookings: parseInt(totals?.total_bookings || 0),
    },
    by_service_type: byServiceType.map((s) => ({
      service_type: s.service_type,
      tax_collected: parseFloat(s.tax_collected || 0),
      revenue: parseFloat(s.revenue || 0),
      count: parseInt(s.count || 0),
    })),
  };
}

function buildCsvContent(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

async function exportReport(reportType, query) {
  let data;
  let headers;
  let rows;

  switch (reportType) {
    case 'revenue': {
      data = await getRevenueReport(query);
      headers = ['date', 'revenue', 'refunds', 'count'];
      rows = data.trend;
      break;
    }
    case 'refunds': {
      data = await getRefundReport(query);
      headers = ['date', 'amount', 'count'];
      rows = data.trend;
      break;
    }
    case 'payouts': {
      data = await getPayoutReport(query);
      headers = ['date', 'amount', 'count'];
      rows = data.trend;
      break;
    }
    case 'taxes': {
      data = await getTaxReport(query);
      headers = ['service_type', 'tax_collected', 'revenue', 'count'];
      rows = data.by_service_type;
      break;
    }
    case 'commissions': {
      data = await getRevenueReport(query);
      headers = ['metric', 'value'];
      rows = Object.entries(data.summary).map(([k, v]) => ({ metric: k, value: v }));
      break;
    }
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  return { csv: buildCsvContent(headers, rows), summary: data.summary || data };
}

module.exports = {
  getRevenueReport,
  getRefundReport,
  getPayoutReport,
  getTaxReport,
  exportReport,
};
