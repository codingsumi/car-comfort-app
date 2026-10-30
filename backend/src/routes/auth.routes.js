const express = require('express');
const multer = require('multer');

const {
  register,
  verifyOtp,
  resendOtp,
  resendOtpByEmail,
  verifyOtpByEmail,
  sendTestSms,
  verifyAppleTokenTest,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  switchRole,
  availableRoles,
  logout
} = require('../controllers/auth.controller');
const {
  registerValidator,
  verifyOtpValidator,
  resendOtpByEmailValidator,
  verifyOtpByEmailValidator,
  sendTestSmsValidator,
  verifyAppleTokenTestValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator,
  switchRoleValidator
} = require('../validators/auth.validators');
const { validateRequest } = require('../middlewares/validateRequest');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.post(
  '/register',
  upload.fields([
    { name: 'profile', maxCount: 1 },
    { name: 'profile_picture', maxCount: 1 }
  ]),
  registerValidator,
  validateRequest,
  register
);
router.post('/verify-otp', authMiddleware, verifyOtpValidator, validateRequest, verifyOtp);
router.post('/resend-otp', authMiddleware, resendOtp);
router.post('/resend-otp-email', resendOtpByEmailValidator, validateRequest, resendOtpByEmail);
router.post('/verify-otp-email', verifyOtpByEmailValidator, validateRequest, verifyOtpByEmail);
router.post('/send-test-sms', sendTestSmsValidator, validateRequest, sendTestSms);
router.post('/apple/verify', upload.none(), verifyAppleTokenTestValidator, validateRequest, verifyAppleTokenTest);
router.post('/login', upload.none(), loginValidator, validateRequest, login);
router.get('/available-roles', authMiddleware, availableRoles);
router.post('/switch-role', authMiddleware, upload.none(), switchRoleValidator, validateRequest, switchRole);
router.post('/forgot-password', forgotPasswordValidator, validateRequest, forgotPassword);
router.post('/verify-reset-otp', verifyResetOtpValidator, validateRequest, verifyResetOtp);
router.post('/reset-password', resetPasswordValidator, validateRequest, resetPassword);
router.post('/logout', authMiddleware, logout);

module.exports = router;

