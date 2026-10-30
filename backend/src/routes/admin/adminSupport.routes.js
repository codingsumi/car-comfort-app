const express = require('express');
const multer = require('multer');
const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const contentCtrl = require('../../controllers/admin/adminContentModeration.controller');
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

router.get('/support/analytics', adminAuth, supportCtrl.getAnalytics);
router.get('/support/live', adminAuth, supportCtrl.getLiveWidgets);
router.get('/support/issues', adminAuth, supportCtrl.getIssues);
router.get('/support/firebase-config', adminAuth, supportCtrl.getFirebaseClientConfig);

router.get('/support/tickets', adminAuth, contentCtrl.listSupportTickets);
router.get('/support/tickets/:id', adminAuth, contentCtrl.getSupportTicket);
router.post('/support/tickets/:id/reply', adminAuth, supportReplyUpload, contentCtrl.postSupportReply);
router.post('/support/tickets/:id/chat/notify', adminAuth, supportCtrl.notifySupportChat);
router.patch('/support/tickets/:id/status', adminAuth, contentCtrl.patchSupportTicketStatus);
router.patch('/support/tickets/:id/assign', adminAuth, supportCtrl.patchAssign);
router.post('/support/tickets/:id/internal-note', adminAuth, supportCtrl.postInternalNote);
router.post('/support/tickets/:id/escalate', adminAuth, supportCtrl.postEscalate);

router.get('/faq/categories', adminAuth, supportCtrl.listFaqCategories);
router.post('/faq/categories', adminAuth, supportCtrl.postFaqCategory);
router.get('/faq', adminAuth, supportCtrl.listFaqs);
router.post('/faq', adminAuth, supportCtrl.postFaq);
router.patch('/faq/reorder', adminAuth, supportCtrl.patchFaqReorder);
router.patch('/faq/:id', adminAuth, supportCtrl.patchFaq);
router.delete('/faq/:id', adminAuth, supportCtrl.deleteFaq);

module.exports = router;
