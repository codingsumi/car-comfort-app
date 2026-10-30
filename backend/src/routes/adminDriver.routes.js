const express = require('express');

const AdminDriverController = require('../controllers/adminDriver.controller');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/requireAdmin');

const router = express.Router();

router.post('/drivers/:userId/approve', authMiddleware, requireAdmin, AdminDriverController.approve);
router.post('/drivers/:userId/reject', authMiddleware, requireAdmin, AdminDriverController.reject);

module.exports = router;

