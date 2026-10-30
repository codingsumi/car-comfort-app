const express = require('express');

const { adminAuth } = require('../../middlewares/admin/auth/authMiddleware');
const {
  list,
  stats,
  approve,
  reject
} = require('../../controllers/admin/adminAccountDeletionRequests.controller');

const router = express.Router();

router.get('/account-deletion-requests/stats', adminAuth, stats);
router.get('/account-deletion-requests', adminAuth, list);
router.patch('/account-deletion-requests/:id/approve', adminAuth, approve);
router.patch('/account-deletion-requests/:id/reject', adminAuth, reject);

module.exports = router;
