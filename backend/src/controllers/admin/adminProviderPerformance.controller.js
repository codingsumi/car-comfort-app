const providerPerformanceService = require('../../services/providerPerformance.service');
const vacuumPenaltyService = require('../../services/vacuumPenalty.service');
const reviewModerationService = require('../../services/reviewModeration.service');
const serviceLimitService = require('../../services/serviceLimit.service');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function getPerformanceDashboard(req, res, next) {
  try {
    const stats = await providerPerformanceService.getDashboardStats();
    return res.success('Dashboard stats fetched', stats);
  } catch (err) {
    return next(err);
  }
}

async function listProviderPerformance(req, res, next) {
  try {
    const result = await providerPerformanceService.listProviderPerformance(req.query);
    return res.success('Provider performance list fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function getProviderPerformanceDetail(req, res, next) {
  try {
    const { id } = req.params;
    const result = await providerPerformanceService.getProviderPerformanceDetail(id);
    if (!result) {
      return res.fail('Provider not found', 404);
    }
    return res.success('Provider performance detail fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function getPerformanceCharts(req, res, next) {
  try {
    const { id } = req.params;
    const { period } = req.query;
    const charts = await providerPerformanceService.getPerformanceCharts(id, period);
    return res.success('Performance charts fetched', charts);
  } catch (err) {
    return next(err);
  }
}

async function exportProvidersCsv(req, res, next) {
  try {
    const csv = await providerPerformanceService.exportProvidersCsv(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=provider-performance.csv');
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
}

async function runAutomatedFlagging(req, res, next) {
  try {
    const result = await providerPerformanceService.runAutomatedFlagging();
    return res.success('Automated flagging completed', result);
  } catch (err) {
    return next(err);
  }
}

async function resolveFlag(req, res, next) {
  try {
    const { flagId } = req.params;
    const { note } = req.body;
    const flag = await providerPerformanceService.resolveFlag(flagId, req.auth.userId, note);
    if (!flag) return res.fail('Flag not found', 404);
    return res.success('Flag resolved', flag);
  } catch (err) {
    return next(err);
  }
}

async function createManualFlag(req, res, next) {
  try {
    const { id } = req.params;
    const { flag_type, severity, notes } = req.body;
    if (!flag_type) return res.fail('flag_type is required', 400);

    const flag = await providerPerformanceService.createManualFlag({
      providerId: id,
      flagType: flag_type,
      severity: severity || 'warning',
      notes,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Provider flagged', flag, 201);
  } catch (err) {
    return next(err);
  }
}

async function getGlobalServiceLimit(req, res, next) {
  try {
    const result = await serviceLimitService.getGlobalDefault();
    return res.success('Global service limit fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function updateGlobalServiceLimit(req, res, next) {
  try {
    const { default_daily_limit, apply_to_all } = req.body;
    const result = await serviceLimitService.updateGlobalDefault({
      defaultDailyLimit: default_daily_limit,
      applyToAll: apply_to_all,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });
    return res.success('Global service limit updated', result);
  } catch (err) {
    return next(err);
  }
}

async function getThresholdSettings(req, res, next) {
  try {
    const settings = await providerPerformanceService.getThresholdSettings();
    return res.success('Threshold settings fetched', settings);
  } catch (err) {
    return next(err);
  }
}

// Vacuum Penalty endpoints

async function createVacuumPenalty(req, res, next) {
  try {
    const { id } = req.params;
    const { booking_id, penalty_amount, deduction_type, reason, evidence_urls } = req.body;

    const penalty = await vacuumPenaltyService.createPenalty({
      providerId: id,
      bookingId: booking_id,
      penaltyAmount: penalty_amount,
      deductionType: deduction_type,
      reason,
      evidenceUrls: evidence_urls,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });

    return res.success('Vacuum penalty issued', penalty, 201);
  } catch (err) {
    return next(err);
  }
}

async function listVacuumPenalties(req, res, next) {
  try {
    const { id } = req.params;
    const result = await vacuumPenaltyService.listPenalties(id, req.query);
    return res.success('Vacuum penalties fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function reverseVacuumPenalty(req, res, next) {
  try {
    const { penaltyId } = req.params;
    const penalty = await vacuumPenaltyService.reversePenalty(
      penaltyId,
      req.auth.userId,
      getClientIp(req)
    );
    return res.success('Vacuum penalty reversed', penalty);
  } catch (err) {
    return next(err);
  }
}

// Review Moderation endpoints

async function listReviews(req, res, next) {
  try {
    const result = await reviewModerationService.listReviews(req.query);
    return res.success('Reviews fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function getReviewStats(req, res, next) {
  try {
    const stats = await reviewModerationService.getReviewStats();
    return res.success('Review stats fetched', stats);
  } catch (err) {
    return next(err);
  }
}

async function updateReviewStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason, moderation_notes } = req.body;

    const review = await reviewModerationService.updateModerationStatus(id, {
      status,
      reason,
      moderation_notes,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });

    return res.success('Review moderation status updated', review);
  } catch (err) {
    return next(err);
  }
}

async function moderateReview(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const review = await reviewModerationService.editReviewContent(id, {
      message,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });

    return res.success('Review content moderated', review);
  } catch (err) {
    return next(err);
  }
}

// Service Limit endpoints

async function getServiceLimit(req, res, next) {
  try {
    const { id } = req.params;
    const result = await serviceLimitService.getServiceLimit(id);
    return res.success('Service limit fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function updateServiceLimit(req, res, next) {
  try {
    const { id } = req.params;
    const { daily_service_limit, service_limit_enabled } = req.body;

    const result = await serviceLimitService.updateServiceLimit(id, {
      dailyServiceLimit: daily_service_limit,
      serviceLimitEnabled: service_limit_enabled,
      adminId: req.auth.userId,
      ipAddress: getClientIp(req),
    });

    return res.success('Service limit updated', result);
  } catch (err) {
    return next(err);
  }
}

async function validateDailyLimit(req, res, next) {
  try {
    const { id } = req.params;
    const result = await serviceLimitService.validateDailyLimit(id);
    return res.success('Daily limit validation result', result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPerformanceDashboard,
  listProviderPerformance,
  getProviderPerformanceDetail,
  getPerformanceCharts,
  exportProvidersCsv,
  runAutomatedFlagging,
  resolveFlag,
  createManualFlag,
  getThresholdSettings,
  createVacuumPenalty,
  listVacuumPenalties,
  reverseVacuumPenalty,
  listReviews,
  getReviewStats,
  updateReviewStatus,
  moderateReview,
  getServiceLimit,
  updateServiceLimit,
  validateDailyLimit,
  getGlobalServiceLimit,
  updateGlobalServiceLimit,
};
