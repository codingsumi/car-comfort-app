const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { findRegistrationConflict } = require('./linkedAccount.service');
const { generateAndSendVerificationOtp } = require('./otp.service');
const { signAuthToken } = require('./jwt.service');
const { sendDriverWelcome, sendDriverProfileCompleted } = require('./lifecycleEmail.service');
const {
  validateDateOfBirth,
  validateSocialSecurityNumber,
  validateDriversLicenseNumber,
  validateDriversLicenseIssuedDate,
  validateDriversLicenseExpirationDate,
  validateAddress,
} = require('../utils/driverPersonalInfo');
const {
  syncDriverLicenseExpirationFromStepData,
  handleLicenseRenewalAfterStepSave,
} = require('./driverLicenseCompliance.service');

function getTotalSteps() {
  // Steps shown in UI are 1..5. OTP verification is the final completion gate.
  const n = Number(process.env.DRIVER_ONBOARDING_TOTAL_STEPS || 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function isStrictMode() {
  const raw = String(process.env.DRIVER_ONBOARDING_STRICT || 'false').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function normalizeStepNumber(stepNumber) {
  const n = Number(stepNumber);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid step number');
  return n;
}

function ensurePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Step data must be an object');
  }
  return value;
}

function getBackgroundCheckStepSpec() {
  return {
    required: [],
    validate: (d) => {
      const consent =
        d.background_check_consent === true ||
        d.background_check_consent === 'true' ||
        d.background_check_consent === 1 ||
        d.background_check_consent === '1';

      const signedForm = d.background_check_signed_form || d.signed_form_url;
      const hasSignedForm = signedForm && String(signedForm).trim().length >= 4;

      if (consent) {
        if (!hasSignedForm) {
          throw new HttpError(400, 'Signed background check form upload is required');
        }
        return;
      }

      if (hasSignedForm) return;
    }
  };
}

function getStepValidators() {
  return {
    // Step 2: Personal info (address, DOB, SSN) + T-shirt size
    2: {
      required: ['tshirt_size', 'address', 'date_of_birth', 'social_security_number'],
      validate: (d) => {
        const allowed = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
        if (d.tshirt_size && !allowed.includes(String(d.tshirt_size).toUpperCase())) {
          throw new HttpError(400, `tshirt_size must be one of: ${allowed.join(', ')}`);
        }
        d.date_of_birth = validateDateOfBirth(d.date_of_birth);
        d.social_security_number = validateSocialSecurityNumber(d.social_security_number);
        d.address = validateAddress(d.address);
      }
    },
    // Step 3: Driver license details + front/back images
    3: {
      required: [
        'drivers_license_number',
        'drivers_license_issued_date',
        'drivers_license_expiration_date',
        'drivers_license_front',
        'drivers_license_back',
      ],
      validate: (d) => {
        d.drivers_license_number = validateDriversLicenseNumber(d.drivers_license_number);
        d.drivers_license_issued_date = validateDriversLicenseIssuedDate(d.drivers_license_issued_date);
        d.drivers_license_expiration_date = validateDriversLicenseExpirationDate(
          d.drivers_license_expiration_date,
          d.drivers_license_issued_date
        );
      }
    },
    // Step 4: Add Vehicle Information
    4: {
      required: ['vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'vehicle_type'],
      validate: (d) => {
        const year = Number(d.vehicle_year);
        if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
          throw new HttpError(400, 'vehicle_year is invalid');
        }
        const rawPlate = d.vehicle_license_plate ?? d.license_plate;
        const plate = String(rawPlate == null ? '' : rawPlate)
          .trim()
          .toUpperCase()
          .replace(/\s+/g, ' ');
        if (!plate || plate.length < 2) {
          throw new HttpError(400, 'vehicle_license_plate is required');
        }
        if (plate.length > 32 || !/^[A-Z0-9][A-Z0-9 -]{0,31}$/.test(plate)) {
          throw new HttpError(
            400,
            'vehicle_license_plate must contain only letters, numbers, spaces or hyphens'
          );
        }
        if (d.vehicle_license_plate !== undefined) d.vehicle_license_plate = plate;
        if (d.license_plate !== undefined) d.license_plate = plate;
      }
    },
    // Step 5: Background check authorization (download blank PDF, upload signed PDF)
    5: getBackgroundCheckStepSpec(),
    // Step 6: Insurance information
    6: {
      required: ['insurance_provider', 'policy_number', 'expiration_date', 'coverage_type'],
      validate(d) {
        const policyNum = String(d.policy_number || '').trim();
        if (!policyNum) throw new HttpError(400, 'policy_number is required');
        if (!/^[A-Za-z0-9]+$/.test(policyNum)) {
          throw new HttpError(400, 'policy_number must contain only alphanumeric characters (no spaces or special characters)');
        }

        const allowed = ['Liability', 'Comprehensive', 'Collision', 'Full coverage', 'Third-party', 'Other'];
        const coverageType = String(d.coverage_type || '').trim();
        if (coverageType && !allowed.some(a => a.toLowerCase() === coverageType.toLowerCase())) {
          throw new HttpError(400, `coverage_type must be one of: ${allowed.join(', ')}`);
        }

        const rawDate = String(d.expiration_date || '').trim();
        if (!rawDate) throw new HttpError(400, 'expiration_date is required');
        const expDate = new Date(rawDate);
        if (isNaN(expDate.getTime())) {
          throw new HttpError(400, 'expiration_date is not a valid date (expected YYYY-MM-DD)');
        }
        if (expDate < new Date()) {
          throw new HttpError(400, 'Insurance policy has already expired. Please provide a valid future expiration date.');
        }
      }
    },
    // Legacy clients may still POST step 8 after vehicle info.
    8: getBackgroundCheckStepSpec()
  };
}

function getRequiredOnboardingSteps() {
  return [2, 3, 4, 5];
}

function isBackgroundCheckStepComplete(stepData) {
  if (!stepData || typeof stepData !== 'object') return false;

  const signedForm = stepData.background_check_signed_form || stepData.signed_form_url;
  return Boolean(signedForm && String(signedForm).trim().length >= 4);
}

function validateStepPayload(stepNumber, payload, { partial = false } = {}) {
  const validators = getStepValidators();
  const spec = validators[stepNumber];
  if (!spec) return;

  if (!partial) {
    const required = Array.isArray(spec.required) ? spec.required : [];
    const missing = required.filter((k) => payload?.[k] === undefined || payload?.[k] === null || String(payload?.[k]).trim() === '');
    if (missing.length) {
      throw new HttpError(
        400,
        'Missing required fields',
        missing.map((f) => ({ field: f, message: `${f} is required` }))
      );
    }
  }

  if (!partial && typeof spec.validate === 'function') spec.validate(payload);
}

async function mergeStepData({ userId, stepNumber, data, partial = false }) {
  const step = normalizeStepNumber(stepNumber);
  const payload = ensurePlainObject(data);

  const profile = await getOrCreateProfile(userId);
  const total = getTotalSteps();

  if (!partial && isStrictMode() && step > (profile.current_step || 1)) {
    throw new HttpError(400, `Cannot skip steps. Current step is ${profile.current_step || 1}`);
  }

  const existing = profile.step_data || {};
  const steps = { ...(existing.steps || {}) };
  const existingStep = steps[String(step)] || {};
  const merged = { ...existingStep, ...payload };

  validateStepPayload(step, merged, { partial });

  steps[String(step)] = merged;

  const nextStep = Math.max(Number(profile.current_step || 1), step + 1);
  const newStepData = { ...existing, steps };

  const updated = await profile.update({
    step_data: newStepData,
    current_step: partial ? profile.current_step : Math.min(nextStep, total + 1),
    ...(profile.approval_status === 'rejected'
      ? { approval_status: 'pending', approval_reason: null, rejected_at: null, approved_at: null }
      : {})
  });

  let refreshed = await db.DriverProfile.findByPk(updated.id);

  if (step === 3) {
    refreshed = await syncDriverLicenseExpirationFromStepData(refreshed);
    if (!partial) {
      await handleLicenseRenewalAfterStepSave({ userId, profile: refreshed });
    }
  }

  return refreshed;
}

function isOnboardingDataComplete(profile) {
  const stepData = profile.step_data || {};
  const steps = stepData.steps || {};

  return getRequiredOnboardingSteps().every((s) => {
    if (s === 5) {
      return isBackgroundCheckStepComplete(steps['5']) || isBackgroundCheckStepComplete(steps['8']);
    }
    const data = steps[String(s)];
    return data && typeof data === 'object';
  });
}

async function ensureDriverUser({ name, email, phone, password }) {
  const existing = await findRegistrationConflict({ role: 'driver', email, phone });

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  if (!existing) {
    const user = await db.User.create({
      name,
      email,
      phone,
      password: passwordHash,
      role: 'driver',
      is_verified: false,
      otp_code: null,
      otp_expiry: null
    });
    return user;
  }

  await existing.update({
    name: name ?? existing.name,
    phone: phone ?? existing.phone,
    password: passwordHash
  });
  return existing;
}

async function getOrCreateProfile(userId) {
  const existing = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (existing) return existing;

  return await db.DriverProfile.create({
    user_id: userId,
    step_data: { steps: {} },
    current_step: 1,
    is_completed: false,
    completed_at: null
  });
}

async function registerDriver({ name, email, phone, password }) {
  const user = await ensureDriverUser({ name, email, phone, password });
  const profile = await getOrCreateProfile(user.id);

  // Send driver onboarding welcome (send-once guarded; failure must not block registration).
  sendDriverWelcome({ user }).catch((err) =>
    console.error('[driver.service] sendDriverWelcome failed (registerDriver):', err?.message ?? err)
  );

  const token = signAuthToken({
    userId: user.id,
    role: user.role,
    tokenVersion: user.token_version || 0
  });

  return {
    token,
    user,
    profile
  };
}

async function getProfileForUser(userId) {
  const profile = await getOrCreateProfile(userId);
  return profile;
}

async function saveStep({ userId, stepNumber, data }) {
  return mergeStepData({ userId, stepNumber, data, partial: false });
}

async function saveStepPartial({ userId, stepNumber, data }) {
  return mergeStepData({ userId, stepNumber, data, partial: true });
}

async function setProfilePicture({ userId, filePathOrUrl }) {
  const profile = await getOrCreateProfile(userId);
  await profile.update({ profile_picture: filePathOrUrl });
  return profile;
}

async function requestVerificationOtp({ userId }) {
  const user = await db.User.findByPk(userId);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role !== 'driver') throw new HttpError(403, 'Forbidden');

  const profile = await getOrCreateProfile(userId);
  if (!isOnboardingDataComplete(profile)) throw new HttpError(400, 'Complete all onboarding steps before verification');

  await generateAndSendVerificationOtp(user);
  return { otp_sent: true };
}

async function verifyDriverOtp({ userId, otp }) {
  const user = await db.User.findByPk(userId);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role !== 'driver') throw new HttpError(403, 'Forbidden');

  const profile = await getOrCreateProfile(userId);
  if (!isOnboardingDataComplete(profile)) throw new HttpError(400, 'Complete all onboarding steps before verification');

  if (!user.otp_code || !user.otp_expiry) throw new HttpError(400, 'OTP not requested');

  const now = new Date();
  if (now > user.otp_expiry) throw new HttpError(400, 'OTP expired');
  if (String(user.otp_code) !== String(otp)) throw new HttpError(400, 'Invalid OTP');

  await user.update({ otp_code: null, otp_expiry: null, is_verified: true });

  const wasCompleted = Boolean(profile.is_completed);
  if (!wasCompleted) {
    const total = getTotalSteps();
    await profile.update({ is_completed: true, completed_at: new Date(), current_step: total + 1 });
  }
  if (!wasCompleted) {
    await sendDriverProfileCompleted({ user });
  }
  return { verified: true };
}

async function markTutorialCompleted({ userId }) {
  const profile = await getOrCreateProfile(userId);
  if (profile.tutorial_completed_at) {
    return profile;
  }
  await profile.update({ tutorial_completed_at: new Date() });
  return profile;
}

/**
 * Single Identity Model: link a driver profile to an already-authenticated user
 * without creating a separate user record or requiring a password.
 *
 * If a driver user with the same email/phone already exists it is returned as-is
 * (idempotent). Otherwise a new driver-role user is created that shares the same
 * credentials as the caller so both roles can use the same login.
 */
async function addDriverRoleToUser({ userId, profilePicturePath }) {
  const user = await db.User.findByPk(userId);
  if (!user) {
    const { HttpError } = require('../utils/httpError');
    throw new HttpError(404, 'User not found');
  }

  // Check if a linked driver account already exists
  const existingDriver = await findRegistrationConflict({
    role: 'driver',
    email: user.email,
    phone: user.phone,
  });

  let driverUser;
  if (existingDriver) {
    driverUser = existingDriver;
  } else {
    // Create a linked driver user that shares the same credentials
    driverUser = await db.User.create({
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      password: user.password,       // reuse the hashed password — same login works
      auth_type: user.auth_type,
      role: 'driver',
      is_verified: user.is_verified,
      otp_code: null,
      otp_expiry: null,
    });
  }

  const profile = await getOrCreateProfile(driverUser.id);
  if (profilePicturePath) {
    await profile.update({ profile_picture: profilePicturePath });
  }

  // Send driver welcome email (send-once guarded; failure must not block registration).
  sendDriverWelcome({ user: driverUser }).catch((err) =>
    console.error('[driver.service] sendDriverWelcome failed (addDriverRoleToUser):', err?.message ?? err)
  );

  const { signAuthToken } = require('./jwt.service');
  const token = signAuthToken({
    userId: driverUser.id,
    role: driverUser.role,
    tokenVersion: driverUser.token_version || 0,
  });

  return { token, user: driverUser, profile };
}

module.exports = {
  getTotalSteps,
  registerDriver,
  addDriverRoleToUser,
  getProfileForUser,
  saveStep,
  saveStepPartial,
  setProfilePicture,
  requestVerificationOtp,
  verifyDriverOtp,
  markTutorialCompleted,
};

