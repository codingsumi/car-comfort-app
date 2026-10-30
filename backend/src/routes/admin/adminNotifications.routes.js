const express = require("express");
const router = express.Router();
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");
const {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../../controllers/admin/adminNotifications.controller");

router.get("/notifications", adminAuth, listNotifications);
router.patch("/notifications/read-all", adminAuth, markAllAsRead);
router.patch("/notifications/:id/read", adminAuth, markAsRead);
router.delete("/notifications/:id", adminAuth, deleteNotification);

module.exports = router;
