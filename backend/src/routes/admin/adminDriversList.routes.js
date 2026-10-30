const express = require("express");
const router = express.Router();
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");
const { listDrivers, getDriver } = require("../../controllers/admin/adminDrivers.controller");

router.get("/drivers", adminAuth, listDrivers);
router.get("/drivers/:driverId", adminAuth, getDriver);

module.exports = router;
