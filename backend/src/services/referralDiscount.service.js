'use strict';

const { Op } = require('sequelize');

const db = require('../models');
const { calcPricing } = require('./pricing.service');

const REFERRAL_DISCOUNT_TYPES = {
  REFERRED_FIRST_BOOKING: 'referred_first_booking',
  REFERRER_REWARD: 'referrer_reward'
};

const DEFAULT_REFERRAL_DISCOUNT_PERCENT = 10;

async function getReferralDiscountPercent() {
  const keys = ['referral_base_discount_percentage', 'referral_service_fee_discount_percentage'];
  try {
    for (const key of keys) {
      const row = await db.AppSetting.findOne({ where: { key } });
      if (!row || row.value === null || row.value === '') continue;
      const n = Number(row.value);
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
    return DEFAULT_REFERRAL_DISCOUNT_PERCENT;
  } catch {
    return DEFAULT_REFERRAL_DISCOUNT_PERCENT;
  }
}

/** @deprecated use getReferralDiscountPercent */
const getReferralServiceFeeDiscountPercent = getReferralDiscountPercent;

/**
 * When a friend signs up with a referral code, both users earn a one-time
 * discount on base price (referred: first booking; referrer: next booking).
 */
async function grantReferralRewardsOnSignup({ newUserId, referrerUserId, transaction } = {}) {
  const newId = Number(newUserId);
  const referrerId = Number(referrerUserId);
  if (!newId || !referrerId || newId === referrerId) return;

  await db.User.update(
    { referral_first_booking_discount_pending: true },
    { where: { id: newId }, transaction }
  );
  await db.User.update(
    { referral_reward_pending: true },
    { where: { id: referrerId }, transaction }
  );
}

async function countCustomerPaidBookings(userId, { transaction, excludeBookingId } = {}) {
  const uid = Number(userId);
  if (!uid) return 0;
  const where = {
    user_id: uid,
    status: { [Op.notIn]: ['draft', 'cancelled', 'failed'] }
  };
  if (excludeBookingId) {
    where.id = { [Op.ne]: Number(excludeBookingId) };
  }
  return db.Booking.count({ where, transaction });
}

/**
 * Resolve which referral discount applies for this booking (does not consume).
 */
async function resolveReferralDiscountForCustomer(userId, { transaction, excludeBookingId } = {}) {
  const uid = Number(userId);
  if (!uid) return null;

  const user = await db.User.findByPk(uid, {
    attributes: [
      'id',
      'referred_by_user_id',
      'referral_first_booking_discount_pending',
      'referral_reward_pending'
    ],
    transaction
  });
  if (!user) return null;

  const discountPercent = await getReferralDiscountPercent();

  if (user.referral_first_booking_discount_pending && user.referred_by_user_id) {
    const priorBookings = await countCustomerPaidBookings(uid, { transaction, excludeBookingId });
    if (priorBookings === 0) {
      return {
        discountPercent,
        discountType: REFERRAL_DISCOUNT_TYPES.REFERRED_FIRST_BOOKING,
        label: `Referral discount (first booking — ${discountPercent}% off base price)`
      };
    }
  }

  if (user.referral_reward_pending) {
    return {
      discountPercent,
      discountType: REFERRAL_DISCOUNT_TYPES.REFERRER_REWARD,
      label: `Referral reward (${discountPercent}% off base price)`
    };
  }

  return null;
}

async function calcPricingWithReferralDiscount({
  basePrice,
  userId,
  excludeBookingId,
  transaction,
  scheduleType,
  serviceType,
  applyTowingFee,
}) {
  const referral = userId
    ? await resolveReferralDiscountForCustomer(userId, { transaction, excludeBookingId })
    : null;

  return calcPricing({
    basePrice,
    referralDiscountPercent: referral?.discountPercent ?? 0,
    scheduleType,
    serviceType,
    applyTowingFee,
  });
}

/** Internal: discount type for persisting on booking (not returned in pricing API). */
async function resolveReferralDiscountTypeForBooking(userId, options = {}) {
  const referral = await resolveReferralDiscountForCustomer(userId, options);
  return referral?.discountType ?? null;
}

async function consumeReferralDiscount({ userId, discountType, transaction } = {}) {
  const uid = Number(userId);
  if (!uid || !discountType) return;

  if (discountType === REFERRAL_DISCOUNT_TYPES.REFERRED_FIRST_BOOKING) {
    await db.User.update(
      { referral_first_booking_discount_pending: false },
      { where: { id: uid }, transaction }
    );
    return;
  }

  if (discountType === REFERRAL_DISCOUNT_TYPES.REFERRER_REWARD) {
    await db.User.update(
      { referral_reward_pending: false },
      { where: { id: uid }, transaction }
    );
  }
}

module.exports = {
  REFERRAL_DISCOUNT_TYPES,
  DEFAULT_REFERRAL_DISCOUNT_PERCENT,
  DEFAULT_REFERRAL_SERVICE_FEE_DISCOUNT_PERCENT: DEFAULT_REFERRAL_DISCOUNT_PERCENT,
  getReferralDiscountPercent,
  getReferralServiceFeeDiscountPercent,
  grantReferralRewardsOnSignup,
  resolveReferralDiscountForCustomer,
  calcPricingWithReferralDiscount,
  resolveReferralDiscountTypeForBooking,
  consumeReferralDiscount
};
