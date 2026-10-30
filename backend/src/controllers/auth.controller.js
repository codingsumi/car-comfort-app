const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { assertUserAccountActive } = require('../utils/accountStatus');
const { saveOriginalImageFile, ensureAbsoluteUrl } = require('../utils/fileUpload');
const { generateAndSendEmailOtp, generateAndSendVerificationOtp } = require('../services/otp.service');
const { sendSms } = require('../services/sms.service');
const { signAuthToken, signResetToken, verifyResetToken } = require('../services/jwt.service');
const { ensureStripeCustomer } = require('../services/stripe.service');
const { verifySocialToken } = require('../services/socialAuth.service');
const { sendCustomerWelcome, sendDriverWelcome } = require('../services/lifecycleEmail.service');
const { generateSystemPassword, hashPassword, validatePassword } = require('../services/userPassword.service');
const { ensureReferralCodeForUser } = require('../services/referral.service');
const { grantReferralRewardsOnSignup } = require('../services/referralDiscount.service');
const { deactivateAllUserDevices } = require('../services/notificationsApp.service');
const { logger } = require('../config/logger');
const {
  findRegistrationConflict,
  findLinkedUserForRole,
  listAvailableAppRoles,
  resolvePasswordLoginUser,
  normalizeEmail,
  normalizePhone
} = require('../services/linkedAccount.service');

async function sendSocialSignupCredentials(user, plainPassword) {
  if (!user?.email || !plainPassword) return;
  // Fire-and-forget: email failure must never block signup/login.
  if (user.role === 'driver') {
    sendDriverWelcome({ user, plainPassword }).catch((err) =>
      console.error('[auth.controller] sendDriverWelcome failed:', err?.message ?? err)
    );
    return;
  }
  if (user.role === 'customer') {
    sendCustomerWelcome({ user, plainPassword }).catch((err) =>
      console.error('[auth.controller] sendCustomerWelcome failed:', err?.message ?? err)
    );
  }
}

function maskEmail(email) {
  const e = typeof email === 'string' ? email.trim() : '';
  const at = e.indexOf('@');
  if (at <= 1) return e || '';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);

  const maskedLocal = `${local.slice(0, 2)}${'x'.repeat(Math.max(0, local.length - 3))}${local.slice(-1)}`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainTld = domainParts.length > 1 ? domainParts.slice(1).join('.') : '';
  const maskedDomainName = domainName
    ? `${domainName.slice(0, 1)}${'x'.repeat(Math.max(0, domainName.length - 1))}`
    : '';
  const maskedDomain = domainTld ? `${maskedDomainName}.${domainTld}` : maskedDomainName;

  return `${maskedLocal}@${maskedDomain}`;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  return `${'x'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}

function normalizeCoordsFromBody(body) {
  const lat = body?.latitude === null || body?.latitude === undefined || body?.latitude === '' ? null : Number(body.latitude);
  const lng =
    body?.longitude === null || body?.longitude === undefined || body?.longitude === '' ? null : Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

async function persistUserLocationIfProvided(user, body) {
  const coords = normalizeCoordsFromBody(body);
  if (!coords) return;
  await user.update({ ...coords, location_updated_at: new Date() });
}

function mapUserUniqueConstraintError(err) {
  if (String(err?.name || '') !== 'SequelizeUniqueConstraintError') return null;
  const fields = err?.fields || {};
  if (fields.email || fields.email_2) {
    return new HttpError(400, 'Email already in use for this account type');
  }
  if (fields.phone || fields.phone_2) {
    return new HttpError(400, 'Phone already in use for this account type');
  }
  return new HttpError(400, 'Account already exists for this email or phone');
}

async function issueLoginSuccess(req, user) {
  await assertUserAccountActive(user);

  if (user.role === 'customer' && !user.is_verified) {
    throw new HttpError(403, 'Account not verified');
  }

  // Increment token_version to invalidate all existing sessions on other devices.
  // Any token carrying the previous version will be rejected by authMiddleware.
  const newVersion = Number(user.token_version || 0) + 1;
  await user.update({ token_version: newVersion });

  const token = signAuthToken({
    userId: user.id,
    role: user.role,
    tokenVersion: newVersion,
  });

  await ensureStripeCustomer(user);

  const driverProfile =
    user.role === 'driver'
      ? await db.DriverProfile.findOne({ where: { user_id: user.id } })
      : null;

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      country_code: user.country_code,
      role: user.role,
      is_verified: user.is_verified,
      agreed_to_terms: user.agreed_to_terms,
      auth_type: user.auth_type,
      social_type: user.social_type,
      profile: driverProfile ? ensureAbsoluteUrl(req, driverProfile.profile_picture) : null
    },
    available_roles: await listAvailableAppRoles(user)
  };
}

async function register(req, res, next) {
  try {
    const {
      auth_type = 'normal',
      social_type,
      social_id,
      social_token,
      first_name,
      last_name,
      name,
      email,
      phone,
      password,
      role,
      agreed_to_terms,
      country_code,
      referral_code,
      latitude,
      longitude
    } = req.body;

    const normalizedReferralCode =
      typeof referral_code === 'string' && referral_code.trim() ? referral_code.trim().toUpperCase() : null;
    const referrer =
      normalizedReferralCode
        ? await db.User.findOne({ where: { referral_code: normalizedReferralCode }, attributes: ['id'] })
        : null;
    if (normalizedReferralCode && !referrer) {
      throw new HttpError(400, 'Invalid referral_code');
    }

    const authType = String(auth_type || 'normal').toLowerCase();
    if (authType !== 'normal' && authType !== 'social') throw new HttpError(400, 'Invalid auth_type');

    if (authType === 'social') {
      const verification = await verifySocialToken({ social_type, social_token });
      const verifiedSocialId = String(verification.provider_user_id);

      if (String(social_id) !== verifiedSocialId) {
        throw new HttpError(401, 'Invalid social_id for token');
      }

      const providerEmail = verification.email ? String(verification.email).trim().toLowerCase() : null;

      // 1) If user exists with this social id -> login directly
      const existing = await db.User.findOne({
        where: {
          social_type: String(social_type).toLowerCase(),
          social_id: String(social_id)
        }
      });

      if (existing) {
        await assertUserAccountActive(existing);
        const existingRegSocialVersion = Number(existing.token_version || 0) + 1;
        await existing.update({
          social_token: String(social_token),
          social_type: String(social_type).toLowerCase(),
          token_version: existingRegSocialVersion,
        });
        await persistUserLocationIfProvided(existing, req.body);

        const token = signAuthToken({
          userId: existing.id,
          role: existing.role,
          tokenVersion: existingRegSocialVersion,
        });

        await ensureStripeCustomer(existing);
        await ensureReferralCodeForUser(existing);

        const driverProfile =
          existing.role === 'driver'
            ? await db.DriverProfile.findOne({ where: { user_id: existing.id } })
            : null;

        return res.success('Login successful', {
          token,
          user: {
            id: existing.id,
            name: existing.name,
            first_name: existing.first_name,
            last_name: existing.last_name,
            email: existing.email,
            phone: existing.phone,
            country_code: existing.country_code,
            role: existing.role,
            is_verified: existing.is_verified,
            agreed_to_terms: existing.agreed_to_terms,
            auth_type: existing.auth_type,
            social_type: existing.social_type,
            profile: driverProfile ? ensureAbsoluteUrl(req, driverProfile.profile_picture) : null
          }
        });
      }

      // 2) If email exists, link the social identity to that user (no duplicates)
      if (providerEmail) {
        const existingByEmail = await db.User.findOne({ where: { email: providerEmail } });
        if (existingByEmail) {
          if (
            existingByEmail.social_id &&
            String(existingByEmail.social_id) !== String(social_id) &&
            String(existingByEmail.social_type || '').toLowerCase() === String(social_type).toLowerCase()
          ) {
            throw new HttpError(400, 'This email is already linked to a different social account');
          }

          const emailSocialVersion = Number(existingByEmail.token_version || 0) + 1;
          await existingByEmail.update({
            social_type: String(social_type).toLowerCase(),
            social_id: String(social_id),
            social_token: String(social_token),
            is_verified: true,
            token_version: emailSocialVersion,
          });
          await persistUserLocationIfProvided(existingByEmail, req.body);

          const token = signAuthToken({
            userId: existingByEmail.id,
            role: existingByEmail.role,
            tokenVersion: emailSocialVersion,
          });

          await ensureStripeCustomer(existingByEmail);
          await ensureReferralCodeForUser(existingByEmail);

          const driverProfile =
            existingByEmail.role === 'driver'
              ? await db.DriverProfile.findOne({ where: { user_id: existingByEmail.id } })
              : null;

          return res.success('Login successful', {
            token,
            user: {
              id: existingByEmail.id,
              name: existingByEmail.name,
              first_name: existingByEmail.first_name,
              last_name: existingByEmail.last_name,
              email: existingByEmail.email,
              phone: existingByEmail.phone,
              country_code: existingByEmail.country_code,
              role: existingByEmail.role,
              is_verified: existingByEmail.is_verified,
              agreed_to_terms: existingByEmail.agreed_to_terms,
              auth_type: existingByEmail.auth_type,
              social_type: existingByEmail.social_type,
              profile: driverProfile ? ensureAbsoluteUrl(req, driverProfile.profile_picture) : null
            }
          });
        }
      }

      // 3) Otherwise create a new user
      const normalizedFirst = typeof first_name === 'string' ? first_name.trim() : (verification.given_name || '');
      const normalizedLast = typeof last_name === 'string' ? last_name.trim() : (verification.family_name || '');
      const normalizedCountryCode = typeof country_code === 'string' ? country_code.trim() : null;
      const fullName =
        typeof name === 'string' && name.trim()
          ? name.trim()
          : (verification.name || `${normalizedFirst} ${normalizedLast}`.trim() || 'User');

      const finalEmail = (typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null) || providerEmail;
      const finalPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
      const finalRole = role || 'customer';
      const isVerified = true; // Social token verification is the proof-of-identity.

      // Some deployments have DB-level NOT NULL constraints on first_name/last_name.
      // Keep them non-null with safe fallbacks for providers like Apple that may not return names.
      const safeFirstName =
        (typeof normalizedFirst === 'string' && normalizedFirst.trim()) ||
        (typeof fullName === 'string' && fullName.trim().split(/\s+/)[0]) ||
        'User';
      const safeLastName =
        (typeof normalizedLast === 'string' && normalizedLast.trim()) ||
        (typeof fullName === 'string' && fullName.trim().split(/\s+/).slice(1).join(' ')) ||
        '';

      const plainPassword =
        typeof password === 'string' && password.trim() ? validatePassword(password.trim()) : generateSystemPassword();
      const passwordHash = await hashPassword(plainPassword);

      const or = [];
      if (finalEmail) or.push({ email: finalEmail });
      if (finalPhone) or.push({ phone: finalPhone });
      const conflict = await findRegistrationConflict({
        role: finalRole,
        email: finalEmail,
        phone: finalPhone
      });
      if (conflict) {
        if (normalizeEmail(conflict.email) === finalEmail) {
          throw new HttpError(400, 'Email already in use for this account type');
        }
        if (normalizePhone(conflict.phone) === finalPhone) {
          throw new HttpError(400, 'Phone already in use for this account type');
        }
      }

      const user = await db.User.create({
        name: fullName,
        first_name: safeFirstName,
        last_name: safeLastName,
        email: finalEmail,
        phone: finalPhone,
        country_code: normalizedCountryCode,
        password: passwordHash,
        role: finalRole,
        is_verified: isVerified,
        agreed_to_terms: Boolean(agreed_to_terms),
        otp_code: null,
        otp_expiry: null,
        auth_type: 'social',
        social_type: String(social_type).toLowerCase(),
        social_id: String(social_id),
        social_token: String(social_token),
        referred_by_user_id: referrer ? referrer.id : null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        location_updated_at: latitude != null && longitude != null ? new Date() : null
      });

      await ensureStripeCustomer(user);
      await ensureReferralCodeForUser(user);
      if (referrer) {
        await grantReferralRewardsOnSignup({ newUserId: user.id, referrerUserId: referrer.id });
      }

      await sendSocialSignupCredentials(user, plainPassword);

      // New account: set token_version to 1 to establish the session baseline.
      await user.update({ token_version: 1 });
      const token = signAuthToken({
        userId: user.id,
        role: user.role,
        tokenVersion: 1,
      });

      return res.success(
        'Registration successful',
        {
          token,
          user: {
            id: user.id,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            country_code: user.country_code,
            role: user.role,
            is_verified: user.is_verified,
            agreed_to_terms: user.agreed_to_terms,
            otp_sent: false,
            auth_type: user.auth_type,
            social_type: user.social_type,
            profile: null
          }
        },
        201
      );
    }

    const normalizedFirst = typeof first_name === 'string' ? first_name.trim() : '';
    const normalizedLast = typeof last_name === 'string' ? last_name.trim() : '';
    const normalizedCountryCode = typeof country_code === 'string' ? country_code.trim() : null;
    const fullName =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : `${normalizedFirst} ${normalizedLast}`.trim();
    const finalRole = role;
    // Customer must verify OTP after normal registration.
    // Admin/garage roles are blocked at the validator level; finalRole here is always customer or driver.
    const isVerified = false;

    const conflict = await findRegistrationConflict({
      role: finalRole,
      email,
      phone
    });
    if (conflict) {
      if (normalizeEmail(conflict.email) === normalizeEmail(email)) {
        throw new HttpError(400, 'Email already in use for this account type');
      }
      if (phone && normalizePhone(conflict.phone) === normalizePhone(phone)) {
        throw new HttpError(400, 'Phone already in use for this account type');
      }
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await db.User.create({
      name: fullName,
      first_name: normalizedFirst || null,
      last_name: normalizedLast || null,
      email,
      phone,
      country_code: normalizedCountryCode,
      password: passwordHash,
      role: finalRole,
      is_verified: isVerified,
      agreed_to_terms: Boolean(agreed_to_terms),
      otp_code: null,
      otp_expiry: null,
      auth_type: 'normal',
      social_type: null,
      social_id: null,
      social_token: null,
      referred_by_user_id: referrer ? referrer.id : null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      location_updated_at: latitude != null && longitude != null ? new Date() : null
    });

    // Keep Stripe customer in sync at signup.
    await ensureStripeCustomer(user);
    await ensureReferralCodeForUser(user);
    if (referrer) {
      await grantReferralRewardsOnSignup({ newUserId: user.id, referrerUserId: referrer.id });
    }

    if (user.role === 'driver') {
      const [profile] = await db.DriverProfile.findOrCreate({
        where: { user_id: user.id },
        defaults: {
          user_id: user.id,
          // Step 1 is registration in the app flow; persist it into onboarding data.
          step_data: {
            steps: {
              '1': {
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                country_code: user.country_code,
                agreed_to_terms: user.agreed_to_terms
              }
            }
          },
          current_step: 2,
          is_completed: false,
          completed_at: null,
          profile_picture: null
        }
      });

      const upload =
        (Array.isArray(req.files?.profile) && req.files.profile[0]) ||
        (Array.isArray(req.files?.profile_picture) && req.files.profile_picture[0]) ||
        null;

      if (upload?.buffer) {
        const saved = await saveOriginalImageFile({
          buffer: upload.buffer,
          uploadDir: 'driver/profile-pictures',
          req,
          fileBaseName: upload.originalname || 'profile'
        });

        await profile.update({ profile_picture: saved.absoluteUrl });
      }

      // Send driver onboarding instructions on registration (send-once guarded;
      // failure must not block registration or redirect).
      sendDriverWelcome({ user }).catch((err) =>
        console.error('[auth.controller] sendDriverWelcome failed (register):', err?.message ?? err)
      );
    }

    let otpSent = false;
    if (user.role === 'customer') {
      if (user.phone) {
        await generateAndSendVerificationOtp(user);
      } else {
        await generateAndSendEmailOtp(user);
      }
      otpSent = true;
    }

    // New account: set token_version to 1 to establish the session baseline.
    await user.update({ token_version: 1 });
    const token = signAuthToken({
      userId: user.id,
      role: user.role,
      tokenVersion: 1,
    });

    const driverProfile =
      user.role === 'driver'
        ? await db.DriverProfile.findOne({ where: { user_id: user.id } })
        : null;

    return res.success(
      'Registration successful',
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          country_code: user.country_code,
          role: user.role,
          is_verified: user.is_verified,
          agreed_to_terms: user.agreed_to_terms,
          otp_sent: otpSent,
          auth_type: user.auth_type,
          social_type: user.social_type,
          profile: driverProfile ? ensureAbsoluteUrl(req, driverProfile.profile_picture) : null
        }
      },
      201
    );
  } catch (err) {
    const mapped = mapUserUniqueConstraintError(err);
    if (mapped) return next(mapped);
    return next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { otp } = req.body;
    const userId = req.auth?.userId;
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, 'User not found');

    if (!user.otp_code || !user.otp_expiry) {
      throw new HttpError(400, 'OTP not requested');
    }

    const now = new Date();
    if (now > user.otp_expiry) {
      throw new HttpError(400, 'OTP expired');
    }

    if (String(user.otp_code) !== String(otp)) {
      throw new HttpError(400, 'Invalid OTP');
    }

    const shouldVerifyUser = user.role === 'customer';
    const wasVerified = Boolean(user.is_verified);

    await user.update({
      otp_code: null,
      otp_expiry: null,
      ...(shouldVerifyUser ? { is_verified: true } : {})
    });

    if (shouldVerifyUser && !wasVerified) {
      await sendCustomerWelcome({ user });
    }

    return res.success('OTP verified successfully', {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function resendOtp(req, res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, 'User not found');

    if (user.role !== 'customer') throw new HttpError(403, 'Forbidden');
    if (user.is_verified) throw new HttpError(400, 'User already verified');

    await generateAndSendVerificationOtp(user);

    return res.success('OTP resent successfully');
  } catch (err) {
    return next(err);
  }
}

async function resendOtpByEmail(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) throw new HttpError(400, 'email is required');

    const user = await db.User.findOne({ where: { email } });
    if (!user) throw new HttpError(404, 'User not found');
    if (user.is_verified) throw new HttpError(400, 'User already verified');

    const result = await generateAndSendVerificationOtp(user);

    const sentToEmail = Boolean(result?.channels?.email);
    const sentToPhone = Boolean(result?.channels?.phone);
    const deliveryMessage =
      sentToEmail && sentToPhone
        ? "We've sent OTP on mail and phone"
        : sentToEmail
          ? "We've sent OTP on mail"
          : sentToPhone
            ? "We've sent OTP on phone"
            : "We've sent OTP";

    return res.success(deliveryMessage, {
      email: maskEmail(user.email),
      phone: user.phone ? maskPhone(user.phone) : undefined
    });
  } catch (err) {
    return next(err);
  }
}

async function verifyOtpByEmail(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = req.body.otp;
    if (!email) throw new HttpError(400, 'email is required');
    if (!otp) throw new HttpError(400, 'otp is required');

    const user = await db.User.findOne({ where: { email } });
    if (!user) throw new HttpError(404, 'User not found');

    if (!user.otp_code || !user.otp_expiry) {
      throw new HttpError(400, 'OTP not requested');
    }

    const now = new Date();
    if (now > user.otp_expiry) {
      throw new HttpError(400, 'OTP expired');
    }

    if (String(user.otp_code) !== String(otp)) {
      throw new HttpError(400, 'Invalid OTP');
    }

    const wasVerified = Boolean(user.is_verified);
    await user.update({
      otp_code: null,
      otp_expiry: null,
      is_verified: true
    });

    if (!wasVerified && user.role === 'customer') {
      await sendCustomerWelcome({ user });
    }
    // After OTP verification, client redirects to login to authenticate.
    return res.success('OTP verified successfully');
  } catch (err) {
    return next(err);
  }
}

async function sendTestSms(req, res, next) {
  try {
    const headerKey = String(req.headers['x-test-sms-key'] || '');
    const expectedKey = String(process.env.TEST_SMS_KEY || '');
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

    if (isProd || expectedKey) {
      if (!expectedKey || headerKey !== expectedKey) throw new HttpError(403, 'Forbidden');
    }

    const phone = req.body.phone;
    const message =
      typeof req.body.message === 'string' && req.body.message.trim()
        ? req.body.message.trim()
        : `Car Comfort test SMS - ${new Date().toISOString()}`;

    const result = await sendSms({ to: phone, text: message });
    return res.success('Test SMS sent', {
      mocked: Boolean(result?.mocked),
      sid: result?.sid
    });
  } catch (err) {
    return next(err);
  }
}

async function verifyAppleTokenTest(req, res, next) {
  try {
    const headerKey = String(req.headers['x-test-apple-key'] || '');
    const expectedKey = String(process.env.TEST_APPLE_KEY || '');
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

    // In production, require TEST_APPLE_KEY + header.
    if (isProd || expectedKey) {
      if (!expectedKey || headerKey !== expectedKey) throw new HttpError(403, 'Forbidden');
    }

    const token = String(req.body?.identity_token || req.body?.social_token || '').trim();
    if (!token) throw new HttpError(400, 'identity_token is required');

    const verification = await verifySocialToken({ social_type: 'apple', social_token: token });

    return res.success('Apple token verified', {
      provider_user_id: verification.provider_user_id,
      email: verification.email,
      email_verified: verification.email_verified,
      apple_configured_audiences: String(process.env.APPLE_CLIENT_ID || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { auth_type = 'normal', social_type, social_id, social_token, email, password } = req.body;
    const authType = String(auth_type || 'normal').toLowerCase();

    if (authType === 'social') {
      const verification = await verifySocialToken({ social_type, social_token });
      const verifiedSocialId = String(verification.provider_user_id);
      if (String(social_id) !== verifiedSocialId) {
        throw new HttpError(401, 'Invalid social_id for token');
      }

      let user = await db.User.findOne({
        where: {
          social_type: String(social_type).toLowerCase(),
          social_id: String(social_id)
        }
      });

      if (!user) {
        const providerEmail = verification.email ? String(verification.email).trim().toLowerCase() : null;
        const fullName =
          (verification.name && String(verification.name).trim()) ||
          [verification.given_name, verification.family_name].filter(Boolean).join(' ').trim() ||
          'User';
        const safeFirstName =
          (verification.given_name && String(verification.given_name).trim()) ||
          (fullName && String(fullName).trim().split(/\s+/)[0]) ||
          'User';
        const safeLastName =
          (verification.family_name && String(verification.family_name).trim()) ||
          (fullName && String(fullName).trim().split(/\s+/).slice(1).join(' ')) ||
          '';

        // If email exists, link and login (no duplicates)
        if (providerEmail) {
          const existingByEmail = await db.User.findOne({ where: { email: providerEmail } });
          if (existingByEmail) {
            if (
              existingByEmail.social_id &&
              String(existingByEmail.social_id) !== String(social_id) &&
              String(existingByEmail.social_type || '').toLowerCase() === String(social_type).toLowerCase()
            ) {
              throw new HttpError(400, 'This email is already linked to a different social account');
            }

            await existingByEmail.update({
              social_type: String(social_type).toLowerCase(),
              social_id: String(social_id),
              social_token: String(social_token),
              is_verified: true
            });

            user = existingByEmail;
          }
        }

        let socialSignupPlainPassword = null;

        if (!user) {
          // First-time social login: create the platform account from verified provider claims.

          socialSignupPlainPassword = generateSystemPassword();
          const passwordHash = await hashPassword(socialSignupPlainPassword);

          user = await db.User.create({
            name: fullName,
            first_name: safeFirstName,
            last_name: safeLastName,
            email: providerEmail,
            phone: null,
            country_code: null,
            password: passwordHash,
            role: 'customer',
            is_verified: true,
            agreed_to_terms: false,
            otp_code: null,
            otp_expiry: null,
            auth_type: 'social',
            social_type: String(social_type).toLowerCase(),
            social_id: String(social_id),
            social_token: String(social_token),
            profile: verification.picture ? { avatar_url: String(verification.picture) } : null,
            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
            location_updated_at: req.body.latitude != null && req.body.longitude != null ? new Date() : null
          });

          await sendSocialSignupCredentials(user, socialSignupPlainPassword);
        }
      } else {
        await user.update({
          social_token: String(social_token),
          social_type: String(social_type).toLowerCase()
        });
      }
      await assertUserAccountActive(user);
      await persistUserLocationIfProvided(user, req.body);

      const socialLoginVersion = Number(user.token_version || 0) + 1;
      await user.update({ token_version: socialLoginVersion });
      const token = signAuthToken({
        userId: user.id,
        role: user.role,
        tokenVersion: socialLoginVersion,
      });

      await ensureStripeCustomer(user);
      await ensureReferralCodeForUser(user);

      const driverProfile =
        user.role === 'driver' ? await db.DriverProfile.findOne({ where: { user_id: user.id } }) : null;

      return res.success('Login successful', {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified,
          auth_type: user.auth_type,
          social_type: user.social_type,
          profile: driverProfile ? ensureAbsoluteUrl(req, driverProfile.profile_picture) : null
        }
      });
    }

    const user = await resolvePasswordLoginUser({
      email,
      password,
      role: req.body.role
    });
    if (!user) throw new HttpError(401, 'Invalid credentials');
    await persistUserLocationIfProvided(user, req.body);

    const payload = await issueLoginSuccess(req, user);
    return res.success('Login successful', payload);
  } catch (err) {
    return next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const user = await db.User.findOne({ where: { email } });
    if (!user) throw new HttpError(404, 'User not found');

    await generateAndSendEmailOtp(user, { purpose: 'reset' });

    return res.success('Reset OTP sent successfully');
  } catch (err) {
    return next(err);
  }
}

async function verifyResetOtp(req, res, next) {
  try {
    const { email, otp } = req.body;

    const user = await db.User.findOne({ where: { email } });
    if (!user) throw new HttpError(404, 'User not found');

    if (!user.otp_code || !user.otp_expiry) {
      throw new HttpError(400, 'OTP not requested');
    }

    const now = new Date();
    if (now > user.otp_expiry) {
      throw new HttpError(400, 'OTP expired');
    }

    if (String(user.otp_code) !== String(otp)) {
      throw new HttpError(400, 'Invalid OTP');
    }

    // OTP is valid for password reset. Clear OTP and return short-lived reset token.
    await user.update({ otp_code: null, otp_expiry: null });

    const reset_token = signResetToken({ userId: user.id });

    return res.success('Reset OTP verified successfully', { reset_token });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { reset_token, new_password } = req.body;

    let payload;
    try {
      payload = verifyResetToken(reset_token);
    } catch (_e) {
      throw new HttpError(401, 'Invalid reset token');
    }

    const user = await db.User.findByPk(payload.userId);
    if (!user) throw new HttpError(404, 'User not found');

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    await user.update({ password: passwordHash });

    return res.success('Password reset successfully');
  } catch (err) {
    return next(err);
  }
}

async function switchRole(req, res, next) {
  try {
    const targetRole = String(req.body.role || '').trim().toLowerCase();
    if (!['customer', 'driver'].includes(targetRole)) {
      throw new HttpError(400, 'role must be customer or driver');
    }

    const current = await db.User.findByPk(req.auth.userId);
    if (!current) throw new HttpError(404, 'User not found');

    if (String(current.role || '').toLowerCase() === targetRole) {
      throw new HttpError(400, 'Already using this account type');
    }

    const target = await findLinkedUserForRole(current, targetRole);
    if (!target) {
      throw new HttpError(
        404,
        targetRole === 'driver'
          ? 'No service provider account found for this phone or email. Please complete service provider signup.'
          : 'No customer account found for this phone or email. Please complete customer signup.'
      );
    }

    await persistUserLocationIfProvided(target, req.body);
    const payload = await issueLoginSuccess(req, target);
    return res.success('Role switched successfully', payload);
  } catch (err) {
    return next(err);
  }
}

async function availableRoles(req, res, next) {
  try {
    const current = await db.User.findByPk(req.auth.userId);
    if (!current) throw new HttpError(404, 'User not found');

    const roles = await listAvailableAppRoles(current);
    return res.success('Available roles', {
      current_role: current.role,
      available_roles: roles
    });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new HttpError(401, 'Unauthorized');

    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, 'User not found');

    try {
      await deactivateAllUserDevices(userId);
    } catch (err) {
      logger.warn('deactivateAllUserDevices on logout failed', { userId, message: err?.message });
    }

    await user.update({ token_version: Number(user.token_version || 0) + 1 });

    return res.success('Logout successful', {
      logged_out: true
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  resendOtpByEmail,
  verifyOtpByEmail,
  sendTestSms,
  verifyAppleTokenTest,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  switchRole,
  availableRoles,
  logout
};
