const analyticsService = require('../../services/adminAnalytics.service');
const exportService = require('../../services/analyticsExport.service');
const db = require('../../models');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

async function logAnalyticsAccess(req, actionType, details = {}) {
  try {
    await db.AdminAuditLog.create({
      admin_id: req.auth.userId,
      action_type: actionType,
      entity_type: 'analytics',
      entity_id: 0,
      details,
      ip_address: getClientIp(req),
    });
  } catch {
    // non-blocking audit
  }
}

async function dashboard(req, res, next) {
  try {
    const data = await analyticsService.getDashboard(req.query);
    await logAnalyticsAccess(req, 'dashboard_view', { filters: req.query });
    return res.success('Dashboard analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function liveKpis(req, res, next) {
  try {
    const data = await analyticsService.getLiveKpis();
    return res.success('Live KPIs fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function bookings(req, res, next) {
  try {
    const data = await analyticsService.getBookingAnalytics(req.query);
    await logAnalyticsAccess(req, 'booking_analytics_view', { filters: req.query });
    return res.success('Booking analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function bookingHeatmap(req, res, next) {
  try {
    const data = await analyticsService.getBookingHeatmap(req.query);
    return res.success('Booking heatmap fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function revenue(req, res, next) {
  try {
    const data = await analyticsService.getRevenueReport(req.query);
    await logAnalyticsAccess(req, 'revenue_analytics_view', { filters: req.query });
    return res.success('Revenue analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function refunds(req, res, next) {
  try {
    const data = await analyticsService.getRefundReport(req.query);
    return res.success('Refund analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function customers(req, res, next) {
  try {
    const data = await analyticsService.getCustomerAnalytics(req.query);
    await logAnalyticsAccess(req, 'customer_analytics_view', { filters: req.query });
    return res.success('Customer analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function customerRetention(req, res, next) {
  try {
    const data = await analyticsService.getCustomerRetention(req.query);
    return res.success('Customer retention analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function providers(req, res, next) {
  try {
    const data = await analyticsService.getProviderAnalytics(req.query);
    await logAnalyticsAccess(req, 'provider_analytics_view', { filters: req.query });
    return res.success('Provider analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function providerComparison(req, res, next) {
  try {
    const data = await analyticsService.getProviderComparison(req.query);
    return res.success('Provider comparison fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function satisfaction(req, res, next) {
  try {
    const data = await analyticsService.getSatisfactionAnalytics(req.query);
    return res.success('Satisfaction analytics fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function createExport(req, res, next) {
  try {
    const { report_type, export_format, filters } = req.body;

    if (!report_type) {
      return res.fail('report_type is required', 400);
    }

    const job = await exportService.createExportJob({
      reportType: report_type,
      exportFormat: export_format || 'csv',
      filters: filters || {},
      requestedBy: req.auth.userId,
    });

    await logAnalyticsAccess(req, 'export_requested', {
      report_type,
      export_format: export_format || 'csv',
      job_id: job.id,
    });

    return res.success('Export job created', { job }, 202);
  } catch (err) {
    return next(err);
  }
}

async function getExport(req, res, next) {
  try {
    const job = await exportService.getExportJob(req.params.id, req.auth.userId);
    if (!job) return res.fail('Export job not found', 404);
    return res.success('Export job fetched', { job });
  } catch (err) {
    return next(err);
  }
}

async function exportHistory(req, res, next) {
  try {
    const data = await exportService.getExportHistory(req.auth.userId, req.query);
    return res.success('Export history fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  dashboard,
  liveKpis,
  bookings,
  bookingHeatmap,
  revenue,
  refunds,
  customers,
  customerRetention,
  providers,
  providerComparison,
  satisfaction,
  createExport,
  getExport,
  exportHistory,
};
