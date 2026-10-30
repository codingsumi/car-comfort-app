const express = require("express");
const router = express.Router();
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");
const { listPayments } = require("../../controllers/admin/adminPayments.controller");

router.get("/payments", adminAuth, listPayments);

module.exports = router;
