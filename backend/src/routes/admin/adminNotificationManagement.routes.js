const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const { notificationSendRateLimit } = require('../../middlewares/admin/notificationRateLimit');
const {
  sendNotificationRules,
  campaignRules,
  templateRules,
  listLogsRules,
  idParamRules,
} = require('../../validators/adminNotificationManagement.validator');
const {
  getDashboard,
  sendNotification,
  getNotificationDetail,
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  retryCampaign,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getAnalytics,
  exportAnalytics,
  listLogs,
  estimateAudience,
} = require('../../controllers/admin/adminNotificationManagement.controller');

router.get('/notifications/overview', adminAuth, getDashboard);
router.post(
  '/notifications/send',
  adminAuth,
  notificationSendRateLimit,
  sendNotificationRules,
  validateRequest,
  sendNotification
);
router.post(
  '/notifications/estimate-audience',
  adminAuth,
  estimateAudience
);

router.get('/notifications/campaigns', adminAuth, listCampaigns);
router.post('/notifications/campaigns', adminAuth, campaignRules, validateRequest, createCampaign);
router.patch(
  '/notifications/campaigns/:id',
  adminAuth,
  idParamRules,
  campaignRules,
  validateRequest,
  updateCampaign
);
router.delete('/notifications/campaigns/:id', adminAuth, idParamRules, validateRequest, deleteCampaign);
router.post(
  '/notifications/campaigns/:id/duplicate',
  adminAuth,
  idParamRules,
  validateRequest,
  duplicateCampaign
);
router.post(
  '/notifications/campaigns/:id/retry',
  adminAuth,
  idParamRules,
  validateRequest,
  retryCampaign
);

router.get('/notifications/templates', adminAuth, listTemplates);
router.post('/notifications/templates', adminAuth, templateRules, validateRequest, createTemplate);
router.patch(
  '/notifications/templates/:id',
  adminAuth,
  idParamRules,
  templateRules,
  validateRequest,
  updateTemplate
);
router.delete('/notifications/templates/:id', adminAuth, idParamRules, validateRequest, deleteTemplate);

router.get('/notifications/analytics', adminAuth, getAnalytics);
router.get('/notifications/analytics/export', adminAuth, exportAnalytics);

router.get('/notifications/logs', adminAuth, listLogsRules, validateRequest, listLogs);

router.get('/notifications/:id', adminAuth, idParamRules, validateRequest, getNotificationDetail);

module.exports = router;
