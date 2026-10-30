const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../models');
const { buildCsvContent, rowsToSheetData } = require('../utils/reportExport');
const { parseDateRange } = require('../utils/reportDateRange');
const analyticsService = require('./adminAnalytics.service');
const { getRevenueReport, getRefundReport, getPayoutReport } = require('./financialReport.service');

const EXPORT_TYPES = [
  'users',
  'customers',
  'providers',
  'bookings',
  'revenue',
  'refunds',
  'payouts',
  'customer_analytics',
  'provider_analytics',
];

async function fetchExportData(reportType, filters) {
  const query = filters || {};

  switch (reportType) {
    case 'users': {
      const users = await db.User.findAll({
        attributes: ['id', 'name', 'email', 'phone', 'role', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 50000,
        raw: true,
      });
      return {
        headers: ['id', 'name', 'email', 'phone', 'role', 'status', 'created_at'],
        rows: users,
      };
    }
    case 'customers': {
      const customers = await db.User.findAll({
        where: { role: 'customer' },
        attributes: ['id', 'name', 'email', 'phone', 'status', 'referral_code', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 50000,
        raw: true,
      });
      return {
        headers: ['id', 'name', 'email', 'phone', 'status', 'referral_code', 'created_at'],
        rows: customers,
      };
    }
    case 'providers': {
      const providers = await db.User.findAll({
        where: { role: 'driver' },
        attributes: ['id', 'name', 'email', 'phone', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 50000,
        raw: true,
      });
      return {
        headers: ['id', 'name', 'email', 'phone', 'status', 'created_at'],
        rows: providers,
      };
    }
    case 'bookings': {
      const { start, end } = parseDateRange(query);
      const where = { created_at: { [require('sequelize').Op.between]: [start, end] } };
      if (query.status) where.status = query.status;
      if (query.service_type) where.service_type = query.service_type;

      const bookings = await db.Booking.findAll({
        where,
        attributes: [
          'id',
          'booking_code',
          'service_type',
          'status',
          'total_price',
          'platform_fee',
          'customer_id',
          'provider_id',
          'created_at',
        ],
        order: [['created_at', 'DESC']],
        limit: 50000,
        raw: true,
      });
      return {
        headers: [
          'id',
          'booking_code',
          'service_type',
          'status',
          'total_price',
          'platform_fee',
          'customer_id',
          'provider_id',
          'created_at',
        ],
        rows: bookings,
      };
    }
    case 'revenue': {
      const data = await getRevenueReport(query);
      return { headers: ['date', 'revenue', 'refunds', 'count'], rows: data.trend };
    }
    case 'refunds': {
      const data = await getRefundReport(query);
      return { headers: ['date', 'amount', 'count'], rows: data.trend };
    }
    case 'payouts': {
      const data = await getPayoutReport(query);
      return { headers: ['date', 'amount', 'count'], rows: data.trend };
    }
    case 'customer_analytics': {
      const data = await analyticsService.getCustomerAnalytics(query);
      const rows = [
        ...data.top_active_customers.map((c) => ({ type: 'active', ...c })),
        ...data.top_profitable_customers.map((c) => ({ type: 'profitable', ...c })),
      ];
      return {
        headers: ['type', 'id', 'name', 'email', 'booking_count', 'total_spent'],
        rows,
      };
    }
    case 'provider_analytics': {
      const data = await analyticsService.getProviderAnalytics(query);
      const rows = data.top_performers.map((p) => ({ category: 'top', ...p }));
      return {
        headers: ['category', 'id', 'name', 'email', 'completed_services', 'avg_rating', 'earnings'],
        rows,
      };
    }
    default:
      throw new Error(`Unknown export type: ${reportType}`);
  }
}

function writeExportFile(reportType, format, headers, rows) {
  const exportDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'reports');
  fs.mkdirSync(exportDir, { recursive: true });

  const timestamp = Date.now();
  const ext = format === 'xlsx' ? 'xlsx' : 'csv';
  const filename = `${reportType}-${timestamp}.${ext}`;
  const filePath = path.join(exportDir, filename);

  if (format === 'xlsx') {
    const sheetData = rowsToSheetData(headers, rows);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filePath);
  } else {
    fs.writeFileSync(filePath, buildCsvContent(headers, rows), 'utf8');
  }

  const publicBase = (process.env.UPLOAD_PUBLIC_BASE || '/uploads').replace(/\/+$/, '');
  return `${publicBase}/reports/${filename}`;
}

async function createExportJob({ reportType, exportFormat, filters, requestedBy }) {
  if (!EXPORT_TYPES.includes(reportType)) {
    throw new Error(`Invalid report type: ${reportType}`);
  }

  const job = await db.ExportJob.create({
    report_type: reportType,
    export_format: exportFormat || 'csv',
    filters: filters || {},
    status: 'pending',
    requested_by: requestedBy,
  });

  setImmediate(() => processExportJob(job.id).catch(() => {}));

  return job;
}

async function processExportJob(jobId) {
  const job = await db.ExportJob.findByPk(jobId);
  if (!job || job.status !== 'pending') return;

  await job.update({ status: 'processing' });

  try {
    const { headers, rows } = await fetchExportData(job.report_type, job.filters);
    const fileUrl = writeExportFile(job.report_type, job.export_format, headers, rows);

    await job.update({
      status: 'completed',
      generated_file_url: fileUrl,
      row_count: rows.length,
    });

    await db.AdminAuditLog.create({
      admin_id: job.requested_by,
      action_type: 'export_completed',
      entity_type: 'export_job',
      entity_id: job.id,
      details: { report_type: job.report_type, row_count: rows.length },
    });
  } catch (err) {
    await job.update({
      status: 'failed',
      error_message: err.message,
    });
  }
}

async function getExportJob(id, adminId) {
  const job = await db.ExportJob.findByPk(id);
  if (!job) return null;
  if (job.requested_by !== adminId) return null;
  return job;
}

async function getExportHistory(adminId, { page = 1, limit = 20 } = {}) {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const { count, rows } = await db.ExportJob.findAndCountAll({
    where: { requested_by: adminId },
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  return {
    items: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      total_pages: Math.ceil(count / limitNum),
    },
  };
}

module.exports = {
  EXPORT_TYPES,
  createExportJob,
  processExportJob,
  getExportJob,
  getExportHistory,
  fetchExportData,
};
