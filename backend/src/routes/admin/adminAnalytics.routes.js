const express = require('express');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const ctrl = require('../../controllers/admin/adminAnalytics.controller');

const router = express.Router();

// Register specific /reports/* paths before content-moderation /reports/:id
router.get('/reports/dashboard', adminAuth, ctrl.dashboard);
router.get('/reports/kpis', adminAuth, ctrl.liveKpis);
router.get('/reports/bookings', adminAuth, ctrl.bookings);
router.get('/reports/bookings/heatmap', adminAuth, ctrl.bookingHeatmap);
router.get('/reports/revenue', adminAuth, ctrl.revenue);
router.get('/reports/refunds', adminAuth, ctrl.refunds);
router.get('/reports/customers', adminAuth, ctrl.customers);
router.get('/reports/customers/retention', adminAuth, ctrl.customerRetention);
router.get('/reports/providers', adminAuth, ctrl.providers);
router.get('/reports/providers/comparison', adminAuth, ctrl.providerComparison);
router.get('/reports/satisfaction', adminAuth, ctrl.satisfaction);

router.post('/reports/export', adminAuth, ctrl.createExport);
router.get('/reports/export/history', adminAuth, ctrl.exportHistory);
router.get('/reports/export/:id', adminAuth, ctrl.getExport);

module.exports = router;
