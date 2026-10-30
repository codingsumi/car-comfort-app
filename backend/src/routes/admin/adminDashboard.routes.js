const express = require("express");
const router = express.Router();
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");
const { getStats } = require("../../controllers/admin/adminDashboard.controller");

router.get("/dashboard/stats", adminAuth, getStats);

module.exports = router;
