const jwt = require("jsonwebtoken");

const db = require("../../../models");
const { HttpError } = require(
  "../../../utils/httpError"
);
const adminSecurityService = require("../../../services/adminSecurity.service");

const adminAuth = async (
  req,
  res,
  next
) => {
  try {
    const bearer =
      req.headers.authorization;

    if (!bearer) {
      throw new HttpError(401, "Unauthorized");
    }

    const token = bearer.split(" ")[1];

    if (!token) {
      throw new HttpError(401, "Unauthorized");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const admin = await db.User.findByPk(decoded.userId);
    if (!admin || admin.role !== "admin") {
      throw new HttpError(401, "Unauthorized");
    }

    if (admin.status && admin.status !== "active") {
      throw new HttpError(403, "Account suspended or deactivated");
    }

    const payloadVersion = Number(decoded.tokenVersion || 0);
    const dbVersion = Number(admin.token_version || 0);
    if (payloadVersion !== dbVersion) {
      throw new HttpError(401, "Session expired");
    }

    if (decoded.sessionId) {
      const session = await db.AdminSession.findByPk(decoded.sessionId);
      if (!session || session.is_revoked || session.admin_id !== decoded.userId) {
        throw new HttpError(401, "Session expired");
      }
      adminSecurityService.touchAdminSession(decoded.sessionId).catch(() => {});
    }

    req.auth = decoded;

    next();
  } catch (err) {
    if (err instanceof HttpError) {
      return next(err);
    }
    return next(
      new HttpError(401, "Invalid token")
    );
  }
};

module.exports = {
  adminAuth,
};