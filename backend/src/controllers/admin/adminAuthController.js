const bcrypt = require("bcrypt");
const db = require("../../models");

const { HttpError } = require("../../utils/httpError");
const { signAuthToken, signResetToken, verifyResetToken } = require("../../services/jwt.service");
const { sendPasswordResetEmail } = require("../../services/email.service");
const adminSecurityService = require("../../services/adminSecurity.service");
const auditLogService = require("../../services/auditLog.service");
const platformReportsService = require("../../services/platformReports.service");

function getClientIp(req) {
  return platformReportsService.getClientIp(req);
}

function getDeviceInfo(req) {
  return auditLogService.parseDeviceInfo(req.headers["user-agent"]);
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email) {
      throw new HttpError(
        400,
        "Email is required"
      );
    }

    if (!password) {
      throw new HttpError(
        400,
        "Password is required"
      );
    }

    // Find Admin
    const admin = await db.User.findOne({
      where: {
        email,
        role: "admin",
      },
    });

    const ipAddress = getClientIp(req);
    const deviceInfo = getDeviceInfo(req);

    if (!admin) {
      await adminSecurityService.recordAuthEvent({
        emailAttempt: email,
        eventType: "login_failed",
        actorType: "admin",
        ipAddress,
        deviceInfo,
      });
      await adminSecurityService.checkFailedLoginAlerts(ipAddress, email);
      throw new HttpError(
        401,
        "Invalid credentials"
      );
    }

    // Password check
    if (!admin.password) {
      throw new HttpError(
        401,
        "Password not set"
      );
    }

    const match = await bcrypt.compare(
      password,
      admin.password
    );

    if (!match) {
      await adminSecurityService.recordAuthEvent({
        userId: admin.id,
        emailAttempt: email,
        eventType: "login_failed",
        actorType: "admin",
        ipAddress,
        deviceInfo,
      });
      await adminSecurityService.checkFailedLoginAlerts(ipAddress, email);
      throw new HttpError(
        401,
        "Invalid credentials"
      );
    }

    // Account verification
    if (!admin.is_verified) {
      throw new HttpError(
        403,
        "Admin account disabled"
      );
    }

    const { sessionId } = await adminSecurityService.createAdminSession(
      admin.id,
      ipAddress,
      deviceInfo
    );

    await adminSecurityService.recordAuthEvent({
      userId: admin.id,
      emailAttempt: email,
      eventType: "login_success",
      actorType: "admin",
      ipAddress,
      deviceInfo,
      metadata: { session_id: sessionId },
    });

    await auditLogService.logAdminAction({
      adminId: admin.id,
      actionType: "admin_login",
      entityType: "admin",
      entityId: admin.id,
      ipAddress,
      deviceInfo,
      module: "auth",
      severity: "info",
    });

    // JWT Token
    const token = signAuthToken({
      userId: admin.id,
      role: admin.role,
      tokenVersion:
        admin.token_version || 0,
      sessionId,
    });

    // Success Response
    return res.success(
      "Login successful",
      {
        token,
        user: {
          id: admin.id,
          name: admin.name,
          first_name: admin.first_name,
          last_name: admin.last_name,
          email: admin.email,
          role: admin.role,
          phone: admin.phone,
          profile: admin.profile,
          is_verified: admin.is_verified,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      }
    );
  } catch (err) {
    return next(err);
  }
}

async function profile(req, res, next) {
  try {
    const admin =
      await db.User.findByPk(
        req.auth.userId,
        {
          attributes: [
            "id",
            "name",
            "first_name",
            "last_name",
            "email",
            "role",
            "phone",
            "profile",
            "is_verified",
            "createdAt",
            "updatedAt",
          ],
        }
      );

    if (!admin) {
      throw new HttpError(
        404,
        "Admin not found"
      );
    }

    const { toAdminUserJson } = require("../../utils/adminJson");
    return res.success(
      "Profile fetched",
      toAdminUserJson(admin)
    );
  } catch (err) {
    return next(err);
  }
}

async function changePassword(
  req,
  res,
  next
) {
  try {
    const {
      old_password,
      new_password,
    } = req.body;

    if (!old_password) {
      throw new HttpError(
        400,
        "Old password is required"
      );
    }

    if (!new_password) {
      throw new HttpError(
        400,
        "New password is required"
      );
    }

    const admin =
      await db.User.findByPk(
        req.auth.userId
      );

    if (!admin) {
      throw new HttpError(
        404,
        "Admin not found"
      );
    }

    const match =
      await bcrypt.compare(
        old_password,
        admin.password
      );

    if (!match) {
      throw new HttpError(
        400,
        "Old password is incorrect"
      );
    }

    const saltRounds = Number(
      process.env
        .BCRYPT_SALT_ROUNDS || 10
    );

    const passwordHash =
      await bcrypt.hash(
        new_password,
        saltRounds
      );

    const newTokenVersion = Number(admin.token_version || 0) + 1;

    await admin.update({
      password: passwordHash,
      token_version: newTokenVersion,
    });

    const ipAddress = getClientIp(req);
    const deviceInfo = getDeviceInfo(req);
    const { sessionId } = await adminSecurityService.createAdminSession(
      admin.id,
      ipAddress,
      deviceInfo
    );

    await adminSecurityService.recordAuthEvent({
      userId: admin.id,
      eventType: "password_change",
      actorType: "admin",
      ipAddress,
      deviceInfo,
    });

    await auditLogService.logAdminAction({
      adminId: admin.id,
      actionType: "admin_password_change",
      entityType: "admin",
      entityId: admin.id,
      ipAddress,
      deviceInfo,
      module: "auth",
      severity: "high",
    });

    const newToken = signAuthToken({
      userId: admin.id,
      role: admin.role,
      tokenVersion: newTokenVersion,
      sessionId,
    });

    return res.success(
      "Password changed successfully",
      { token: newToken }
    );
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const admin =
      await db.User.findByPk(
        req.auth.userId
      );

    if (!admin) {
      throw new HttpError(
        404,
        "Admin not found"
      );
    }

    const ipAddress = getClientIp(req);
    const deviceInfo = getDeviceInfo(req);

    await admin.update({
      token_version:
        Number(
          admin.token_version || 0
        ) + 1,
    });

    if (req.auth?.sessionId) {
      await db.AdminSession.update(
        { is_revoked: true, revoked_at: new Date() },
        { where: { id: req.auth.sessionId } }
      );
    }

    await adminSecurityService.recordAuthEvent({
      userId: admin.id,
      eventType: "logout",
      actorType: "admin",
      ipAddress,
      deviceInfo,
    });

    await auditLogService.logAdminAction({
      adminId: admin.id,
      actionType: "admin_logout",
      entityType: "admin",
      entityId: admin.id,
      ipAddress,
      deviceInfo,
      module: "auth",
    });

    return res.success(
      "Logout successful"
    );
  } catch (err) {
    return next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new HttpError(400, "Email is required");

    const admin = await db.User.findOne({ where: { email, role: "admin" } });

    if (!admin) throw new HttpError(404, "No account found with this email address");

    const token = signResetToken({ userId: admin.id });
    const frontendUrl = process.env.ADMIN_FRONTEND_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(admin.email, resetLink);

    return res.success("Password reset link has been sent to your email", { email: admin.email });
  } catch (err) {
    return next(err);
  }
}

async function resendResetLink(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new HttpError(400, "Email is required");

    const admin = await db.User.findOne({ where: { email, role: "admin" } });

    if (!admin) throw new HttpError(404, "No account found with this email address");

    const token = signResetToken({ userId: admin.id });
    const frontendUrl = process.env.ADMIN_FRONTEND_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(admin.email, resetLink);

    return res.success("Password reset link has been resent to your email");
  } catch (err) {
    return next(err);
  }
}

async function verifyResetTokenHandler(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) throw new HttpError(400, "Token is required");

    try {
      verifyResetToken(token);
    } catch {
      throw new HttpError(400, "Invalid or expired reset token");
    }

    return res.success("Token is valid");
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, new_password } = req.body;
    if (!token) throw new HttpError(400, "Token is required");
    if (!new_password) throw new HttpError(400, "New password is required");

    let payload;
    try {
      payload = verifyResetToken(token);
    } catch {
      throw new HttpError(400, "Invalid or expired reset token");
    }

    const admin = await db.User.findOne({ where: { id: payload.userId, role: "admin" } });
    if (!admin) throw new HttpError(404, "Admin not found");

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    await admin.update({
      password: passwordHash,
      token_version: Number(admin.token_version || 0) + 1,
    });

    await adminSecurityService.recordAuthEvent({
      userId: admin.id,
      eventType: "password_reset",
      actorType: "admin",
      ipAddress: getClientIp(req),
      deviceInfo: getDeviceInfo(req),
    });

    await auditLogService.logAdminAction({
      adminId: admin.id,
      actionType: "admin_password_reset",
      entityType: "admin",
      entityId: admin.id,
      ipAddress: getClientIp(req),
      module: "auth",
      severity: "high",
    });

    return res.success("Password reset successfully");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  login,
  profile,
  changePassword,
  logout,
  forgotPassword,
  resendResetLink,
  verifyResetToken: verifyResetTokenHandler,
  resetPassword,
};