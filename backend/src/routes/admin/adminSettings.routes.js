const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const { validateRequest } = require('../../middlewares/validateRequest');
const adminSettingsController = require('../../controllers/admin/adminSettings.controller');
const adminServiceAreasController = require('../../controllers/admin/adminServiceAreas.controller');
const {
  validateGroupParam,
  validateAuditLogsQuery,
  validateServiceAreaBody,
  validateServiceAreaId,
  validateTestEmailBody,
  groupValidators,
} = require('../../validators/settings.validator');

const router = Router();

const settingsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { status: 'error', message: 'Too many settings requests, please try again later' },
});

const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'settings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `setting-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, SVG, WebP, ICO) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function dynamicGroupValidation(req, res, next) {
  const { group } = req.params;
  const validators = groupValidators[group];
  if (!validators) return next();

  Promise.all(validators.map((v) => v.run(req))).then(() => {
    validateRequest(req, res, next);
  });
}

function handleGroupUpdate(req, res, next) {
  return adminSettingsController.updateSettingsByGroup(req, res, next);
}

// Public endpoints
router.get('/branding', settingsRateLimit, adminSettingsController.getAdminPanelBranding);
router.get('/settings/public', settingsRateLimit, adminSettingsController.getPublicSettings);

// Settings — specific routes before :group param
router.get('/settings', adminAuth, settingsRateLimit, adminSettingsController.getAllSettings);

router.get(
  '/settings/audit-logs',
  adminAuth,
  settingsRateLimit,
  validateAuditLogsQuery,
  validateRequest,
  adminSettingsController.getAuditLogs
);

router.delete(
  '/settings/audit-logs',
  adminAuth,
  settingsRateLimit,
  validateAuditLogsQuery,
  validateRequest,
  adminSettingsController.deleteAllAuditLogs
);

router.post(
  '/settings/payments/test-stripe',
  adminAuth,
  settingsRateLimit,
  adminSettingsController.testStripeConnection
);

router.post(
  '/settings/email/test',
  adminAuth,
  settingsRateLimit,
  validateTestEmailBody,
  validateRequest,
  adminSettingsController.testEmailConnection
);

// Service areas
router.get('/settings/service-areas', adminAuth, settingsRateLimit, adminServiceAreasController.listServiceAreas);

router.post(
  '/settings/service-areas',
  adminAuth,
  settingsRateLimit,
  validateServiceAreaBody,
  validateRequest,
  adminServiceAreasController.createServiceArea
);

router.patch(
  '/settings/service-areas/:id',
  adminAuth,
  settingsRateLimit,
  validateServiceAreaId,
  validateServiceAreaBody,
  validateRequest,
  adminServiceAreasController.updateServiceArea
);

router.delete(
  '/settings/service-areas/:id',
  adminAuth,
  settingsRateLimit,
  validateServiceAreaId,
  validateRequest,
  adminServiceAreasController.deleteServiceArea
);

router.post(
  '/settings/upload',
  adminAuth,
  settingsRateLimit,
  upload.single('file'),
  adminSettingsController.uploadSettingsFile
);

// Group-based settings (GET/PUT/PATCH)
router.get(
  '/settings/:group',
  adminAuth,
  settingsRateLimit,
  validateGroupParam,
  validateRequest,
  adminSettingsController.getSettingsByGroup
);

router.put(
  '/settings/:group',
  adminAuth,
  settingsRateLimit,
  validateGroupParam,
  dynamicGroupValidation,
  handleGroupUpdate
);

router.patch(
  '/settings/:group',
  adminAuth,
  settingsRateLimit,
  validateGroupParam,
  dynamicGroupValidation,
  handleGroupUpdate
);

module.exports = router;
