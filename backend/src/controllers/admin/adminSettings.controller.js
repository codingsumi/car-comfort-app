const db = require('../../models');
const settingsService = require('../../services/settings.service');
const settingsRuntimeService = require('../../services/settingsRuntime.service');
const { HttpError } = require('../../utils/httpError');

async function getAllSettings(req, res, next) {
  try {
    const settings = await settingsService.getAllSettings(db);
    return res.success('Settings fetched successfully', settings);
  } catch (err) {
    return next(err);
  }
}

async function getSettingsByGroup(req, res, next) {
  try {
    const { group } = req.params;
    const settings = await settingsService.getSettingsByGroup(db, group);
    return res.success(`${group} settings fetched`, settings);
  } catch (err) {
    return next(err);
  }
}

async function updateSettingsByGroup(req, res, next) {
  try {
    const { group } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      throw new HttpError(400, 'No settings provided to update');
    }

    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const result = await settingsService.updateSettingsByGroup(db, group, updates, {
      userId: req.auth.userId,
      ip,
      userAgent,
    });

    return res.success(`${group} settings updated successfully`, result);
  } catch (err) {
    return next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, group } = req.query;
    const result = await settingsService.getAuditLogs(db, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      groupName: group,
    });
    return res.success('Audit logs fetched', result);
  } catch (err) {
    return next(err);
  }
}

async function deleteAllAuditLogs(req, res, next) {
  try {
    const { group } = req.query;
    const result = await settingsService.deleteAllAuditLogs(db, {
      groupName: group ? String(group).trim() : undefined,
    });
    return res.success(
      result.deleted
        ? `${result.deleted} audit log${result.deleted === 1 ? '' : 's'} deleted`
        : 'No audit logs to delete',
      result
    );
  } catch (err) {
    return next(err);
  }
}

async function uploadSettingsFile(req, res, next) {
  try {
    if (!req.file) {
      throw new HttpError(400, 'No file uploaded');
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`;
    const uploadBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
    const filePath = `${baseUrl}${uploadBase}/settings/${req.file.filename}`;

    return res.success('File uploaded successfully', { url: filePath, filename: req.file.filename });
  } catch (err) {
    return next(err);
  }
}

async function getAdminPanelBranding(req, res, next) {
  try {
    const branding = await settingsService.getAdminPanelBranding(db);
    return res.success('Admin panel branding fetched', branding);
  } catch (err) {
    return next(err);
  }
}

async function testStripeConnection(req, res, next) {
  try {
    const result = await settingsRuntimeService.testStripeConnection(db);
    return res.success('Stripe connection successful', result);
  } catch (err) {
    if (!err.status) err.status = 400;
    return next(err);
  }
}

async function testEmailConnection(req, res, next) {
  try {
    const { to } = req.body || {};
    const result = await settingsRuntimeService.testSmtpConnection(db, { to });
    return res.success(to ? 'Test email sent successfully' : 'SMTP connection verified', result);
  } catch (err) {
    if (!err.status) err.status = 400;
    return next(err);
  }
}

async function getPublicSettings(req, res, next) {
  try {
    const settings = await settingsService.getPublicSettings(db);
    return res.success('Public settings fetched', settings);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllSettings,
  getSettingsByGroup,
  updateSettingsByGroup,
  getAuditLogs,
  deleteAllAuditLogs,
  uploadSettingsFile,
  getAdminPanelBranding,
  testStripeConnection,
  testEmailConnection,
  getPublicSettings,
};
