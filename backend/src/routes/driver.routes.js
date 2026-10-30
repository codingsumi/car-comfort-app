const express = require('express');
const multer = require('multer');
const { body, query } = require('express-validator');

const DriverAuthController = require('../controllers/driverAuth.controller');
const DriverBookingsController = require('../controllers/driverBookings.controller');
const DriverLocationController = require('../controllers/driverLocation.controller');
const DriverPresenceController = require('../controllers/driverPresence.controller');
const DriverWalletController = require('../controllers/driverWallet.controller');
const { redirectKyc } = require('../controllers/driverStripeKycRedirect.controller');
const userFeedbackController = require('../controllers/userFeedback.controller');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { assertDriverCanOperate } = require('../middlewares/driverLicenseActive.middleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { createDriverLocationLimiter } = require('../middlewares/driverLocationRateLimit');
const {
  stepNumberValidator,
  driverVerifyOtpValidator,
  updateDriverProfileValidator,
  driverUpdateServiceLocationValidator
} = require('../validators/driver.validators');

const router = express.Router();

/** Stripe KYC return/refresh → 302 to driver app (no auth; opened by browser after onboarding). */
router.get('/stripe/connect/kyc/redirect/:kind', redirectKyc);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

function reportSubmitUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return reportUpload.array('attachments[]', 10)(req, res, next);
  }
  return next();
}
const driverLocationLimiter = createDriverLocationLimiter();

router.get('/me', authMiddleware, DriverAuthController.me);

// Single Identity Model: link a provider profile to the current account (no new registration needed)
router.post(
  '/add-profile',
  authMiddleware,
  upload.single('profile_picture'),
  DriverAuthController.addDriverProfile,
);
router.post('/tutorial/complete', authMiddleware, assertDriverCanOperate, DriverAuthController.completeTutorial);
router.get('/wallet', authMiddleware, assertDriverCanOperate, DriverWalletController.getWallet);
router.get(
  '/wallet/transactions',
  authMiddleware,
  assertDriverCanOperate,
  [
    query('type').optional().isIn(['credit', 'debit']).withMessage('type must be credit or debit'),
    query('status').optional().isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  ],
  validateRequest,
  DriverWalletController.listTransactions
);
router.get(
  '/wallet/earnings-statement',
  authMiddleware,
  assertDriverCanOperate,
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('year is invalid'),
    query('period').optional().isIn(['week', 'month', 'year']).withMessage('period is invalid'),
    query('from')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('from must be YYYY-MM-DD'),
    query('to')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('to must be YYYY-MM-DD'),
  ],
  validateRequest,
  DriverWalletController.downloadEarningsStatement
);
router.post(
  '/wallet/payout',
  authMiddleware,
  assertDriverCanOperate,
  [body('amount').optional().isFloat({ min: 0.01 }).withMessage('amount must be a positive number')],
  validateRequest,
  DriverWalletController.createPayout
);
router.get('/stripe/connect/kyc', authMiddleware, DriverWalletController.getConnectStatus);
router.post('/stripe/connect/reconnect', authMiddleware, DriverWalletController.reconnectConnect);
router.patch(
  '/me',
  authMiddleware,
  upload.single('profile'),
  updateDriverProfileValidator,
  validateRequest,
  DriverAuthController.updateProfile
);

router.get(
  '/bookings/nearby-unassigned',
  authMiddleware,
  assertDriverCanOperate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('latitude must be -90..90'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('longitude must be -180..180')
  ],
  validateRequest,
  DriverBookingsController.listNearbyUnassigned
);

router.patch(
  '/bookings/:id/service-location',
  authMiddleware,
  assertDriverCanOperate,
  driverUpdateServiceLocationValidator,
  validateRequest,
  DriverBookingsController.patchServiceLocation
);

router.post(
  '/me/presence',
  authMiddleware,
  assertDriverCanOperate,
  driverLocationLimiter,
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be -90..90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be -180..180')
  ],
  validateRequest,
  DriverPresenceController.postPresence
);

router.post(
  '/location',
  authMiddleware,
  assertDriverCanOperate,
  driverLocationLimiter,
  [
    body('booking_id').isInt({ min: 1 }).withMessage('booking_id must be a positive integer'),
    body('provider_id').isInt({ min: 1 }).withMessage('provider_id must be a positive integer'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be -90..90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be -180..180')
  ],
  validateRequest,
  DriverLocationController.postLocation
);
router.post('/step/:stepNumber', authMiddleware, stepNumberValidator, validateRequest, DriverAuthController.saveStep);
router.post(
  '/profile-picture',
  authMiddleware,
  upload.single('profile_picture'),
  DriverAuthController.uploadProfilePicture
);
router.post(
  '/documents',
  authMiddleware,
  upload.fields([
    { name: 'drivers_license_front', maxCount: 1 },
    { name: 'drivers_license_back', maxCount: 1 },
    { name: 'background_check_signed_form', maxCount: 1 },
    { name: 'insurance_card_front', maxCount: 1 },
    { name: 'insurance_card_back', maxCount: 1 },
  ]),
  DriverAuthController.uploadDocuments
);

router.post('/request-verification-otp', authMiddleware, DriverAuthController.requestVerificationOtp);
router.post('/verify-otp', authMiddleware, driverVerifyOtpValidator, validateRequest, DriverAuthController.verifyOtp);

router.post('/reports', authMiddleware, reportSubmitUpload, userFeedbackController.submitReport);
router.post('/support/tickets', authMiddleware, userFeedbackController.createTicket);
router.get('/support/tickets', authMiddleware, userFeedbackController.listMyTickets);
router.get('/support/tickets/:id', authMiddleware, userFeedbackController.getMyTicket);
router.post('/support/tickets/:id/messages', authMiddleware, userFeedbackController.replyMyTicket);
router.post('/support/tickets/:id/chat/notify', authMiddleware, userFeedbackController.notifySupportChat);

module.exports = router;

