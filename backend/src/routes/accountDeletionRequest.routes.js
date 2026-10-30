const express = require('express');

const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  createMine,
  sendPublicOtp,
  submitPublic
} = require('../controllers/accountDeletionRequest.controller');

const router = express.Router();

router.post('/me', authMiddleware, createMine);
router.post('/public/send-otp', sendPublicOtp);
router.post('/public/submit', submitPublic);

module.exports = router;
