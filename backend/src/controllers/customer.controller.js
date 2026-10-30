const { Op } = require('sequelize');

const db = require('../models');
const { getReferralDiscountPercent } = require('../services/referralDiscount.service');
const { getOpenDeletionRequestForUser } = require('../services/accountDeletionRequest.service');
const { HttpError } = require('../utils/httpError');
const { assertCustomerAuth } = require('../utils/customerAuth');
const { listCustomerBillingHistory } = require('../services/customerBillingHistory.service');
const { bufferToWebp, saveWebpFile } = require('../utils/fileUpload');

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

function unwrapStringLiteral(raw) {
  // Handles cases where DB/body stores a JSON string literal: "\"http://...\"" or '"http://..."'
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed.trim() || null;
    } catch (_e) {
      // Fall through to manual unwrapping.
      return trimmed.slice(1, -1).trim() || null;
    }
  }

  return trimmed;
}

function getProfileUrlFromStoredProfile(profile) {
  if (!profile) return null;
  if (typeof profile === 'string') return unwrapStringLiteral(profile);
  if (typeof profile === 'object' && !Array.isArray(profile)) {
    const url = typeof profile.picture_url === 'string' ? unwrapStringLiteral(profile.picture_url) : null;
    return url || null;
  }
  return null;
}

function normalizeProfileUrlFromBody(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'string') {
    const raw = unwrapStringLiteral(value);
    if (!raw) return undefined;
    if (!raw) return undefined;

    // Allow plain URL string OR a JSON string like {"picture_url":"..."}.
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;

    const parsed = JSON.parse(raw);
    if (parsed === null) return null;
    if (typeof parsed === 'string') return parsed.trim() || null;
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const url = typeof parsed.picture_url === 'string' ? parsed.picture_url.trim() : '';
      return url || null;
    }
    return undefined;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const url = typeof value.picture_url === 'string' ? value.picture_url.trim() : '';
    return url || null;
  }

  return undefined;
}

async function me(req, res, next) {
  try {
    const userId = assertCustomerAuth(req);
    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, 'User not found');

    const active_referrals_count = await db.User.count({ where: { referred_by_user_id: userId } });
    const referral_discount_percent = await getReferralDiscountPercent();
    const account_deletion_request = await getOpenDeletionRequestForUser(userId);

    return res.success('Customer profile fetched', {
      user: {
        id: user.id,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        profile: getProfileUrlFromStoredProfile(user.profile),
        referral_code: user.referral_code,
        referral_share_count: user.referral_share_count,
        active_referrals_count,
        referral_reward_pending: Boolean(user.referral_reward_pending),
        referral_first_booking_discount_pending: Boolean(user.referral_first_booking_discount_pending),
        referral_discount_percent,
        role: user.role,
        is_verified: user.is_verified,
        agreed_to_terms: user.agreed_to_terms
      },
      account_deletion_request
    });
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = assertCustomerAuth(req);
    const user = await db.User.findByPk(userId);
    if (!user) throw new HttpError(404, 'User not found');

    const first_name = normalizeString(req.body.first_name);
    const last_name = normalizeString(req.body.last_name);
    const name = normalizeString(req.body.name);
    const phone = normalizeString(req.body.phone);
    const profileUrl = normalizeProfileUrlFromBody(req.body.profile);

    const updates = {};

    if (first_name !== null) updates.first_name = first_name;
    if (last_name !== null) updates.last_name = last_name;
    if (phone !== null) updates.phone = phone;
    if (profileUrl !== undefined) updates.profile = profileUrl;

    if (req.file?.buffer) {
      const webp = await bufferToWebp(req.file.buffer, { width: 300, height: 300, fit: 'cover', quality: 82 });
      const saved = await saveWebpFile({
        buffer: webp,
        uploadDir: 'customer/profile-pictures',
        req,
        fileBaseName: req.file.originalname || 'profile'
      });

      updates.profile = saved.absoluteUrl;
    }

    // If `name` omitted, compute from first/last if either provided.
    if (name !== null) {
      updates.name = name;
    } else if (first_name !== null || last_name !== null) {
      const composed = `${first_name ?? user.first_name ?? ''} ${last_name ?? user.last_name ?? ''}`.trim();
      if (composed) updates.name = composed;
    }

    if (!Object.keys(updates).length) {
      throw new HttpError(400, 'No fields to update');
    }

    if (updates.phone && updates.phone !== user.phone) {
      const existing = await db.User.findOne({
        where: { phone: updates.phone, id: { [Op.ne]: user.id } }
      });
      if (existing) throw new HttpError(400, 'Phone already in use');
    }

    await user.update(updates);

    const active_referrals_count = await db.User.count({ where: { referred_by_user_id: userId } });
    const referral_discount_percent = await getReferralDiscountPercent();

    return res.success('Customer profile updated', {
      user: {
        id: user.id,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        profile: getProfileUrlFromStoredProfile(user.profile),
        referral_code: user.referral_code,
        referral_share_count: user.referral_share_count,
        active_referrals_count,
        referral_reward_pending: Boolean(user.referral_reward_pending),
        referral_first_booking_discount_pending: Boolean(user.referral_first_booking_discount_pending),
        referral_discount_percent,
        role: user.role,
        is_verified: user.is_verified,
        agreed_to_terms: user.agreed_to_terms
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  me,
  updateProfile,
  async incrementReferralShare(req, res, next) {
    try {
      const userId = assertCustomerAuth(req);
      const user = await db.User.findByPk(userId);
      if (!user) throw new HttpError(404, 'User not found');

      await user.update({ referral_share_count: Number(user.referral_share_count || 0) + 1 });
      return res.success('Referral share recorded', { referral_share_count: user.referral_share_count });
    } catch (err) {
      return next(err);
    }
  },
  async billingHistory(req, res, next) {
    try {
      const data = await listCustomerBillingHistory(req, req.query);
      return res.success('Billing history fetched', data);
    } catch (err) {
      return next(err);
    }
  }
};

