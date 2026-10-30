const db = require('../models');
const { Op } = require('sequelize');
const { HttpError } = require('../utils/httpError');
const DriverService = require('../services/driver.service');
const { loadDriverLicenseComplianceForUser } = require('../middlewares/driverLicenseActive.middleware');
const { getOpenDeletionRequestForUser } = require('../services/accountDeletionRequest.service');
const {
  bufferToWebp,
  saveWebpFile,
  saveBinaryFile,
  saveOriginalImageFile,
  ensureAbsoluteUrl
} = require('../utils/fileUpload');

function assertDriverAuth(req) {
  const userId = req.auth?.userId;
  const role = req.auth?.role;
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');
  return userId;
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;
    const { token, user, profile } = await DriverService.registerDriver({ name, email, phone, password });

    return res.success(
      'Service provider registration successful',
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified
        },
        driver_profile: {
          id: profile.id,
          user_id: profile.user_id,
          profile_picture: profile.profile_picture,
          current_step: profile.current_step,
          is_completed: profile.is_completed,
          approval_status: profile.approval_status,
          approval_reason: profile.approval_reason,
          approved_at: profile.approved_at,
          rejected_at: profile.rejected_at
        }
      },
      201
    );
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const profile = await DriverService.getProfileForUser(userId);
    const user = await db.User.findByPk(userId);
    const account_deletion_request = await getOpenDeletionRequestForUser(userId);
    const licenseCompliance = await loadDriverLicenseComplianceForUser(userId);
    const refreshedUser = licenseCompliance
      ? await db.User.findByPk(userId)
      : user;

    return res.success('Service provider profile fetched', {
      user: {
        id: refreshedUser.id,
        name: refreshedUser.name,
        email: refreshedUser.email,
        phone: refreshedUser.phone,
        role: refreshedUser.role,
        is_verified: refreshedUser.is_verified,
        status: refreshedUser.status,
        suspended_reason: refreshedUser.suspended_reason,
      },
      driver_profile: {
        id: profile.id,
        user_id: profile.user_id,
        profile_picture: ensureAbsoluteUrl(req, profile.profile_picture),
        step_data: profile.step_data,
        current_step: profile.current_step,
        is_completed: profile.is_completed,
        completed_at: profile.completed_at,
        tutorial_completed_at: profile.tutorial_completed_at,
        approval_status: profile.approval_status,
        approval_reason: profile.approval_reason,
        approved_at: profile.approved_at,
        rejected_at: profile.rejected_at,
        drivers_license_expiration_date: profile.drivers_license_expiration_date,
        license_hold_active: profile.license_hold_active,
        ...(licenseCompliance?.license_compliance || {}),
      },
      onboarding: {
        total_steps: DriverService.getTotalSteps()
      },
      account_deletion_request
    });
  } catch (err) {
    return next(err);
  }
}

async function saveStep(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const stepNumber = req.params.stepNumber;
    const profile = await DriverService.saveStep({ userId, stepNumber, data: req.body });

    return res.success('Step saved', {
      driver_profile: {
        id: profile.id,
        user_id: profile.user_id,
        profile_picture: ensureAbsoluteUrl(req, profile.profile_picture),
        current_step: profile.current_step,
        is_completed: profile.is_completed,
        completed_at: profile.completed_at,
        tutorial_completed_at: profile.tutorial_completed_at,
        approval_status: profile.approval_status,
        approval_reason: profile.approval_reason,
        approved_at: profile.approved_at,
        rejected_at: profile.rejected_at,
        step_data: profile.step_data
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadProfilePicture(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    if (!req.file) throw new HttpError(400, 'profile_picture file is required');

    const saved = await saveOriginalImageFile({
      buffer: req.file.buffer,
      uploadDir: 'driver/profile-pictures',
      req,
      fileBaseName: req.file.originalname || 'profile'
    });

    const profile = await DriverService.setProfilePicture({ userId, filePathOrUrl: saved.absoluteUrl });

    return res.success('Profile picture uploaded', {
      driver_profile: {
        id: profile.id,
        profile_picture: ensureAbsoluteUrl(req, profile.profile_picture)
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function uploadDocuments(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const files = req.files || {};

    const mapping = [
      { field: 'drivers_license_front', step: 3, uploadDir: 'driver/documents/drivers-license', variant: 'front', quality: 78 },
      { field: 'drivers_license_back', step: 3, uploadDir: 'driver/documents/drivers-license', variant: 'back', quality: 78 },
      {
        field: 'background_check_signed_form',
        step: 5,
        uploadDir: 'driver/documents/background-check',
        variant: 'signed-form',
        pdfOnly: true
      },
      { field: 'insurance_card_front', step: 6, uploadDir: 'driver/documents/insurance-card', variant: 'front', quality: 78, imageOnly: true },
      { field: 'insurance_card_back', step: 6, uploadDir: 'driver/documents/insurance-card', variant: 'back', quality: 78, imageOnly: true },
    ];

    const out = {};
    const updatesByStep = new Map();

    for (const m of mapping) {
      const f = Array.isArray(files[m.field]) ? files[m.field][0] : null;
      if (!f) continue;

      let saved;
      if (m.pdfOnly) {
        const isPdf = f.mimetype === 'application/pdf';
        if (!isPdf) throw new HttpError(400, `${m.field} must be a PDF file`);
        saved = await saveBinaryFile({
          buffer: f.buffer,
          uploadDir: m.uploadDir,
          req,
          fileBaseName: f.originalname || m.field,
          extension: 'pdf'
        });
      } else if (m.imageOnly) {
        const isImage = f.mimetype && f.mimetype.startsWith('image/');
        if (!isImage) throw new HttpError(400, `${m.field} must be an image`);
        const webp = await bufferToWebp(f.buffer, { quality: m.quality, maxWidth: 2000 });
        saved = await saveWebpFile({
          buffer: webp,
          uploadDir: m.uploadDir,
          req,
          fileBaseName: f.originalname || m.field,
          variant: m.variant
        });
      } else {
        const webp = await bufferToWebp(f.buffer, { quality: m.quality, maxWidth: 2000 });
        saved = await saveWebpFile({
          buffer: webp,
          uploadDir: m.uploadDir,
          req,
          fileBaseName: f.originalname || m.field,
          variant: m.variant
        });
      }

      out[m.field] = saved.absoluteUrl;
      if (!updatesByStep.has(m.step)) updatesByStep.set(m.step, {});
      updatesByStep.get(m.step)[m.field] = saved.absoluteUrl;
    }

    if (!Object.keys(out).length) throw new HttpError(400, 'No files uploaded');

    // Persist into step_data via idempotent step upserts.
    for (const [step, data] of updatesByStep.entries()) {
      await DriverService.saveStepPartial({ userId, stepNumber: step, data });
    }

    return res.success('Documents uploaded', { files: out });
  } catch (err) {
    return next(err);
  }
}

async function requestVerificationOtp(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const result = await DriverService.requestVerificationOtp({ userId });
    return res.success('OTP sent', result);
  } catch (err) {
    return next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const { otp } = req.body;
    const result = await DriverService.verifyDriverOtp({ userId, otp });
    return res.success('OTP verified successfully', result);
  } catch (err) {
    return next(err);
  }
}

async function completeTutorial(req, res, next) {
  try {
    const userId = assertDriverAuth(req);
    const profile = await DriverService.markTutorialCompleted({ userId });

    return res.success('Tutorial completed', {
      driver_profile: {
        id: profile.id,
        user_id: profile.user_id,
        tutorial_completed_at: profile.tutorial_completed_at,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Single Identity Model — add a driver/provider profile to the currently
 * authenticated user without requiring a new registration or password.
 *
 * POST /driver/add-profile
 * Auth: any authenticated user (customer or driver)
 * Body (multipart): profile_picture (optional)
 */
async function addDriverProfile(req, res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new HttpError(401, 'Unauthorized');

    let profilePicturePath = null;
    if (req.file?.buffer) {
      const saved = await saveOriginalImageFile({
        buffer: req.file.buffer,
        uploadDir: 'driver/profile-pictures',
        req,
        fileBaseName: req.file.originalname || 'profile',
      });
      profilePicturePath = saved.absoluteUrl;
    }

    const { token, user, profile } = await DriverService.addDriverRoleToUser({
      userId,
      profilePicturePath,
    });

    return res.success(
      'Service provider profile linked to your account',
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified,
        },
        driver_profile: {
          id: profile.id,
          user_id: profile.user_id,
          profile_picture: ensureAbsoluteUrl(req, profile.profile_picture),
          current_step: profile.current_step,
          is_completed: profile.is_completed,
          approval_status: profile.approval_status,
          approval_reason: profile.approval_reason,
          approved_at: profile.approved_at,
          rejected_at: profile.rejected_at,
        },
      },
      201,
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  me,
  addDriverProfile,
  async updateProfile(req, res, next) {
    try {
      const userId = assertDriverAuth(req);
      const user = await db.User.findByPk(userId);
      if (!user) throw new HttpError(404, 'User not found');

      const first_name = typeof req.body.first_name === 'string' ? req.body.first_name.trim() : null;
      const last_name = typeof req.body.last_name === 'string' ? req.body.last_name.trim() : null;
      const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : null;

      const updates = {};
      if (first_name) updates.first_name = first_name;
      if (last_name !== null) updates.last_name = last_name || '';
      if (phone) updates.phone = phone;

      // `name` is derived on backend from first/last.
      if (first_name !== null || last_name !== null) {
        const composed = `${first_name ?? user.first_name ?? ''} ${last_name ?? user.last_name ?? ''}`.trim();
        if (composed) updates.name = composed;
      }

      if (updates.phone && updates.phone !== user.phone) {
        const existing = await db.User.findOne({
          where: { phone: updates.phone, id: { [Op.ne]: user.id } },
          attributes: ['id']
        });
        if (existing) throw new HttpError(400, 'Phone already in use');
      }

      const profile = await DriverService.getProfileForUser(userId);

      // Optional file upload: allow updating the driver profile picture here too.
      if (req.file?.buffer) {
        const saved = await saveOriginalImageFile({
          buffer: req.file.buffer,
          uploadDir: 'driver/profile-pictures',
          req,
          fileBaseName: req.file.originalname || 'profile'
        });
        await profile.update({ profile_picture: saved.absoluteUrl });
      }

      if (!Object.keys(updates).length && !req.file?.buffer) {
        throw new HttpError(400, 'No fields to update');
      }

      if (Object.keys(updates).length) {
        await user.update(updates);
      }

      const refreshedProfile = await DriverService.getProfileForUser(userId);
      const refreshedUser = await db.User.findByPk(userId);

      return res.success('Service provider profile updated', {
        user: {
          id: refreshedUser.id,
          name: refreshedUser.name,
          first_name: refreshedUser.first_name,
          last_name: refreshedUser.last_name,
          email: refreshedUser.email,
          phone: refreshedUser.phone,
          role: refreshedUser.role,
          is_verified: refreshedUser.is_verified
        },
        driver_profile: {
          id: refreshedProfile.id,
          user_id: refreshedProfile.user_id,
          profile_picture: ensureAbsoluteUrl(req, refreshedProfile.profile_picture),
          step_data: refreshedProfile.step_data,
          current_step: refreshedProfile.current_step,
          is_completed: refreshedProfile.is_completed,
          completed_at: refreshedProfile.completed_at,
          tutorial_completed_at: refreshedProfile.tutorial_completed_at,
          approval_status: refreshedProfile.approval_status,
          approval_reason: refreshedProfile.approval_reason,
          approved_at: refreshedProfile.approved_at,
          rejected_at: refreshedProfile.rejected_at
        }
      });
    } catch (err) {
      return next(err);
    }
  },
  saveStep,
  uploadProfilePicture,
  uploadDocuments,
  requestVerificationOtp,
  verifyOtp,
  completeTutorial,
};
