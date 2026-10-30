const express = require("express");

const router = express.Router();

const controller = require(
  "../../../controllers/admin/adminAuthController"
);

const {
  adminAuth,
} = require(
  "../../../middlewares/admin/auth/authMiddleware"
);

router.post(
  "/login",
  controller.login
);

router.post(
  "/forgot-password",
  controller.forgotPassword
);

router.post(
  "/resend-reset-link",
  controller.resendResetLink
);

router.post(
  "/verify-reset-token",
  controller.verifyResetToken
);

router.post(
  "/reset-password",
  controller.resetPassword
);

router.get(
  "/profile",
  adminAuth,
  controller.profile
);

router.post(
  "/change-password",
  adminAuth,
  controller.changePassword
);

router.post(
  "/logout",
  adminAuth,
  controller.logout
);

module.exports = router;