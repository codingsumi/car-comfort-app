const express = require('express');
const multer = require('multer');

const CustomerController = require('../controllers/customer.controller');
const userFeedbackController = require('../controllers/userFeedback.controller');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { updateCustomerProfileValidator } = require('../validators/customer.validators');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }
});

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

router.get('/me', authMiddleware, CustomerController.me);
router.get('/billing-history', authMiddleware, CustomerController.billingHistory);
router.patch(
  '/me',
  authMiddleware,
  upload.single('profile'),
  updateCustomerProfileValidator,
  validateRequest,
  CustomerController.updateProfile
);
router.post('/referral/share', authMiddleware, CustomerController.incrementReferralShare);

router.post('/reports', authMiddleware, reportSubmitUpload, userFeedbackController.submitReport);
router.post('/support/tickets', authMiddleware, userFeedbackController.createTicket);
router.get('/support/tickets', authMiddleware, userFeedbackController.listMyTickets);
router.get('/support/tickets/:id', authMiddleware, userFeedbackController.getMyTicket);
router.post('/support/tickets/:id/messages', authMiddleware, userFeedbackController.replyMyTicket);
router.post('/support/tickets/:id/chat/notify', authMiddleware, userFeedbackController.notifySupportChat);

module.exports = router;

