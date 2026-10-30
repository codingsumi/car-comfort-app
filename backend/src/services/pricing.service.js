const db = require('../models');
const { resolveBookingPricingFees } = require('./bookingCharges.service');

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function roundTwo(n) {
  return Number(n.toFixed(2));
}

async function getFinanceSetting(key, fallback) {
  try {
    const row = await db.AppSetting.findOne({ where: { key } });
    if (!row || row.value === null || row.value === '') return fallback;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

async function getServiceFeePercent() {
  return getFinanceSetting('service_fee_percentage', 10);
}

async function getPlatformFeePercent() {
  return getFinanceSetting('platform_fee_percentage', 5);
}

async function getTaxPercent() {
  return getFinanceSetting('default_tax_percentage', 8);
}

function calcEvChargingCost({ batteryCapacityKwh, vehicleChargeLimit, currentBatteryCharge, ratePerKw }) {
  const capacity = toNumber(batteryCapacityKwh);
  const limitPct = toNumber(vehicleChargeLimit);
  const currentChargePct = toNumber(currentBatteryCharge);
  const rate = toNumber(ratePerKw);

  const targetKwh = roundTwo((capacity * limitPct) / 100);
  const currentKwh = roundTwo((capacity * currentChargePct) / 100);
  const kwhToCharge = Math.max(0, roundTwo(targetKwh - currentKwh));
  const chargingCost = roundTwo(kwhToCharge * rate);

  return { targetKwh, currentKwh, kwhToCharge, chargingCost };
}

async function calcPricing({
  basePrice,
  serviceFeePercent,
  platformFeePercent,
  taxPercent,
  referralDiscountPercent,
  referralServiceFeeDiscountPercent,
  scheduleType,
  serviceType,
  applyTowingFee,
}) {
  const sfPct = serviceFeePercent !== undefined ? toNumber(serviceFeePercent) : await getServiceFeePercent();
  const pfPct = platformFeePercent !== undefined ? toNumber(platformFeePercent) : await getPlatformFeePercent();
  const txPct = taxPercent !== undefined ? toNumber(taxPercent) : await getTaxPercent();
  const referralPct = Math.min(
    100,
    Math.max(0, toNumber(referralDiscountPercent ?? referralServiceFeeDiscountPercent))
  );

  const baseBeforeDiscount = Math.max(0, toNumber(basePrice));
  const referral_discount_amount =
    referralPct > 0 ? roundTwo((baseBeforeDiscount * referralPct) / 100) : 0;
  const base = roundTwo(Math.max(0, baseBeforeDiscount - referral_discount_amount));

  // Fees/tax on pre-discount base; referral is subtracted from the final total.
  const serviceFee = roundTwo((baseBeforeDiscount * sfPct) / 100);
  const platformFee = roundTwo((baseBeforeDiscount * pfPct) / 100);
  const taxableAmount = roundTwo(baseBeforeDiscount + serviceFee + platformFee);
  const tax = roundTwo((taxableAmount * txPct) / 100);

  const bookingFees = await resolveBookingPricingFees({ scheduleType, serviceType, applyTowingFee });
  const convenience_fee = roundTwo(bookingFees.convenience_fee);
  const on_demand_fee = roundTwo(bookingFees.on_demand_fee);
  const towing_fee = roundTwo(bookingFees.towing_fee);
  const extra_fees_total = roundTwo(bookingFees.extra_fees_total || 0);

  const subtotal_before_referral = roundTwo(
    baseBeforeDiscount +
      serviceFee +
      platformFee +
      tax +
      convenience_fee +
      on_demand_fee +
      towing_fee +
      extra_fees_total
  );
  const total = roundTwo(Math.max(0, subtotal_before_referral - referral_discount_amount));

  return {
    base_price_before_discount: baseBeforeDiscount,
    base_price: base,
    service_fee: serviceFee,
    service_fee_percent: sfPct,
    platform_fee: platformFee,
    platform_fee_percent: pfPct,
    convenience_fee,
    on_demand_fee,
    towing_fee,
    extra_fees: bookingFees.extra_fees || [],
    extra_fees_total,
    tax,
    tax_percent: txPct,
    subtotal_before_referral,
    total_price: total,
    referral_discount_percent: referralPct,
    referral_discount_amount,
  };
}

module.exports = {
  getServiceFeePercent,
  getPlatformFeePercent,
  getTaxPercent,
  calcEvChargingCost,
  calcPricing
};
