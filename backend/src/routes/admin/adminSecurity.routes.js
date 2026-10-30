const express = require('express');
const rateLimit = require('express-rate-limit');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const securityCtrl = require('../../controllers/admin/adminSecurity.controller');

const router = express.Router();

const securityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many sensitive operations, please try again later' },
});

router.use(securityLimiter);

router.get('/security/analytics', adminAuth, securityCtrl.getDashboard);
router.get('/security/live', adminAuth, securityCtrl.getLiveWidgets);

router.get('/security/logs', adminAuth, securityCtrl.listLogs);
router.get('/security/logs/:id', adminAuth, securityCtrl.getLogById);

router.get('/security/sessions', adminAuth, securityCtrl.listSessions);
router.post('/security/sessions/:id/revoke', adminAuth, sensitiveLimiter, securityCtrl.revokeSession);
router.post('/security/sessions/:id/force-logout', adminAuth, sensitiveLimiter, securityCtrl.forceLogoutSession);

router.get('/security/compliance', adminAuth, securityCtrl.listCompliance);
router.post('/security/compliance', adminAuth, securityCtrl.postComplianceRequest);
router.post('/security/compliance/:id/process', adminAuth, sensitiveLimiter, securityCtrl.processCompliance);
router.post('/security/export-user-data', adminAuth, sensitiveLimiter, securityCtrl.exportUserData);

router.get('/security/alerts', adminAuth, securityCtrl.listAlerts);
router.patch('/security/alerts/:id/status', adminAuth, securityCtrl.patchAlertStatus);

router.get('/security/admin-overview', adminAuth, securityCtrl.getAdminSecurityOverview);
router.get('/security/data-retention', adminAuth, securityCtrl.getDataRetentionSettings);
router.patch('/security/data-retention', adminAuth, sensitiveLimiter, securityCtrl.updateDataRetentionSettings);
router.get('/security/alert-notifications', adminAuth, securityCtrl.getAlertNotificationSettings);
router.patch('/security/alert-notifications', adminAuth, securityCtrl.updateAlertNotificationSettings);

module.exports = router;
