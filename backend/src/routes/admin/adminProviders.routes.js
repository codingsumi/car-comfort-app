const express = require('express');
const multer = require('multer');
const router = express.Router();
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const {
  listProviders,
  getProvider,
  updateProviderStatus,
  approveProvider,
  rejectProvider,
  updateInsuranceStatus,
  resetProviderPassword,
  downloadProviderServiceRecord,
  downloadProviderProfilePhoto,
  uploadProviderProfilePhoto,
  updateProviderProfile,
  getProviderLoginHistory,
} = require('../../controllers/admin/adminProviders.controller');

const profilePhotoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

router.get('/providers', adminAuth, listProviders);
router.get('/providers/:id', adminAuth, getProvider);
router.get('/providers/:id/bookings/:bookingId/service-record.pdf', adminAuth, downloadProviderServiceRecord);
router.get('/providers/:id/profile-photo/download', adminAuth, downloadProviderProfilePhoto);
router.patch('/providers/:id/status', adminAuth, updateProviderStatus);
router.patch('/providers/:id/approve', adminAuth, approveProvider);
router.patch('/providers/:id/reject', adminAuth, rejectProvider);
router.patch('/providers/:id/insurance-status', adminAuth, updateInsuranceStatus);
router.post('/providers/:id/reset-password', adminAuth, resetProviderPassword);
router.post('/providers/:id/profile-photo', adminAuth, profilePhotoUpload.single('profile_photo'), uploadProviderProfilePhoto);
router.patch('/providers/:id/profile', adminAuth, updateProviderProfile);
router.get('/providers/:id/login-history', adminAuth, getProviderLoginHistory);

module.exports = router;
