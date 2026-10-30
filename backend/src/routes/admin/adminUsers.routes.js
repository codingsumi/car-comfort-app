const express = require("express");
const router = express.Router();
const { listUsers, getUser, deleteUser, createAdmin, updateAdmin } = require("../../controllers/admin/adminUsers.controller");
const { adminAuth } = require("../../middlewares/admin/auth/authMiddleware");

router.get("/users", adminAuth, listUsers);
router.post("/users/admin", adminAuth, createAdmin);
router.get("/users/:userId", adminAuth, getUser);
router.patch("/users/:userId/admin", adminAuth, updateAdmin);
router.delete("/users/:userId", adminAuth, deleteUser);

module.exports = router;
