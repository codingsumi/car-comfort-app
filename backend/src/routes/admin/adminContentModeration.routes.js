const express = require('express');
const multer = require('multer');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const ctrl = require('../../controllers/admin/adminContentModeration.controller');
const supportCtrl = require('../../controllers/admin/adminSupport.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
});

function supportReplyUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return upload.array('files', 8)(req, res, next);
  }
  return next();
}

router.get('/moderation/dashboard', adminAuth, ctrl.getDashboard);

router.get('/moderation/reviews/stats', adminAuth, ctrl.getReviewStats);
router.get('/moderation/reviews', adminAuth, ctrl.listReviews);
router.get('/moderation/reviews/:id', adminAuth, ctrl.getReview);
router.patch('/moderation/reviews/:id/status', adminAuth, ctrl.patchReviewStatus);
router.patch('/moderation/reviews/:id/edit', adminAuth, ctrl.patchReviewEdit);
router.post('/moderation/reviews/:id/respond', adminAuth, ctrl.postReviewResponse);
router.delete('/moderation/reviews/:id/respond', adminAuth, ctrl.deleteReviewResponse);

router.get('/reports', adminAuth, ctrl.listReports);
router.get('/reports/:id', adminAuth, ctrl.getReport);
router.patch('/reports/:id/status', adminAuth, ctrl.patchReportStatus);
router.post('/reports/:id/notes', adminAuth, ctrl.postReportNote);

router.get('/support/tickets', adminAuth, ctrl.listSupportTickets);
router.get('/support/tickets/:id', adminAuth, ctrl.getSupportTicket);
router.post(
  '/support/tickets/:id/reply',
  adminAuth,
  supportReplyUpload,
  ctrl.postSupportReply
);
router.post('/support/tickets/:id/chat/notify', adminAuth, supportCtrl.notifySupportChat);
router.patch('/support/tickets/:id/status', adminAuth, ctrl.patchSupportTicketStatus);
router.patch('/support/tickets/:id/assign', adminAuth, supportCtrl.patchAssign);
router.post('/support/tickets/:id/internal-note', adminAuth, supportCtrl.postInternalNote);
router.post('/support/tickets/:id/escalate', adminAuth, supportCtrl.postEscalate);
router.post('/support/email', adminAuth, supportCtrl.sendEmailToCustomer);
router.get('/support/email-history', adminAuth, supportCtrl.listEmailHistory);

router.get('/faqs/categories', adminAuth, ctrl.listFaqCategories);
router.post('/faqs/categories', adminAuth, ctrl.postFaqCategory);
router.get('/faqs', adminAuth, ctrl.listFaqs);
router.post('/faqs', adminAuth, ctrl.postFaq);
router.patch('/faqs/:id', adminAuth, ctrl.patchFaq);
router.delete('/faqs/:id', adminAuth, ctrl.deleteFaq);

router.get('/moderation/logs', adminAuth, ctrl.listModerationLogs);

module.exports = router;
