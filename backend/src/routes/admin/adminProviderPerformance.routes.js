const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const ctrl = require('../../controllers/admin/adminProviderPerformance.controller');

// Provider Performance Dashboard
router.get('/provider-performance/stats', adminAuth, ctrl.getPerformanceDashboard);
router.get('/provider-performance/export', adminAuth, ctrl.exportProvidersCsv);
router.get('/provider-performance/thresholds', adminAuth, ctrl.getThresholdSettings);
router.post('/provider-performance/run-flagging', adminAuth, ctrl.runAutomatedFlagging);
router.get('/provider-performance', adminAuth, ctrl.listProviderPerformance);
router.get('/provider-performance/:id', adminAuth, ctrl.getProviderPerformanceDetail);
router.get('/provider-performance/:id/charts', adminAuth, ctrl.getPerformanceCharts);

// Provider Flags
router.post('/providers/:id/flag', adminAuth, ctrl.createManualFlag);
router.patch('/provider-flags/:flagId/resolve', adminAuth, ctrl.resolveFlag);

// Vacuum Penalties
router.post('/providers/:id/vacuum-penalty', adminAuth, ctrl.createVacuumPenalty);
router.get('/providers/:id/vacuum-penalties', adminAuth, ctrl.listVacuumPenalties);
router.patch('/vacuum-penalties/:penaltyId/reverse', adminAuth, ctrl.reverseVacuumPenalty);

// Review Moderation
router.get('/reviews/stats', adminAuth, ctrl.getReviewStats);
router.get('/reviews', adminAuth, ctrl.listReviews);
router.patch('/reviews/:id/status', adminAuth, ctrl.updateReviewStatus);
router.patch('/reviews/:id/moderate', adminAuth, ctrl.moderateReview);

// Service Limits
router.get('/service-limits/global', adminAuth, ctrl.getGlobalServiceLimit);
router.patch('/service-limits/global', adminAuth, ctrl.updateGlobalServiceLimit);
router.get('/providers/:id/service-limit', adminAuth, ctrl.getServiceLimit);
router.patch('/providers/:id/service-limit', adminAuth, ctrl.updateServiceLimit);
router.get('/providers/:id/validate-daily-limit', adminAuth, ctrl.validateDailyLimit);

module.exports = router;
