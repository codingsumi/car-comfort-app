const db = require('../models');
const { logger } = require('../config/logger');
const {
  BOOKING_CHARGE_CODES,
  BOOKING_CHARGE_LABELS,
  DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT,
} = require('../constants/bookingChargeCodes');
const {
  BOOKING_CHARGE_SERVICE_APPLICABILITY,
  normalizeServiceApplicability,
  chargeAppliesToServiceType,
} = require('../constants/bookingChargeApplicability');

const CUSTOMER_CANCELLATION_FEE_CODE = BOOKING_CHARGE_CODES.CUSTOMER_CANCELLATION_FEE;
const CUSTOMER_NO_SHOW_FEE_CODE = BOOKING_CHARGE_CODES.CUSTOMER_NO_SHOW_FEE;

// EV_CHARGING_FEES_CODE is the booking_charges DB code for the EV service fee.
// It must be excluded from extra_fees because the EV service fee is already
// added explicitly from the package base_price in bookingPriceSummary.service.js.
// Including it here would cause it to appear twice on the price summary.
const EV_CHARGING_FEES_CODE = 'ev_charging_fees';

const PRICING_CHARGE_CODES = new Set([
  BOOKING_CHARGE_CODES.CONVENIENCE_FEE,
  BOOKING_CHARGE_CODES.ON_DEMAND_SERVICES,
  BOOKING_CHARGE_CODES.TOWING_SERVICES,
  EV_CHARGING_FEES_CODE,
]);

const DEFAULT_CHARGE_AMOUNTS = {
  [BOOKING_CHARGE_CODES.TOWING_SERVICES]: 75,
  [BOOKING_CHARGE_CODES.ON_DEMAND_SERVICES]: 50,
  [BOOKING_CHARGE_CODES.CONVENIENCE_FEE]: 1.99,
  [BOOKING_CHARGE_CODES.CUSTOMER_NO_SHOW_FEE]: 25,
  [CUSTOMER_CANCELLATION_FEE_CODE]: 25,
  [BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE]: DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT,
};

const CACHE_TTL_MS = 30_000;
let chargesCache = null;
let chargesCacheAt = 0;

function clearBookingChargesCache() {
  chargesCache = null;
  chargesCacheAt = 0;
}

function toAmount(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function formatChargeRow(plain) {
  return {
    code: plain.code,
    label: plain.label,
    amount: toAmount(plain.amount),
    service_applicability: normalizeServiceApplicability(plain.service_applicability),
    sort_order: Number(plain.sort_order || 0),
  };
}

async function loadActiveChargesRows() {
  if (!db.BookingCharge) return null;
  try {
    return await db.BookingCharge.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
  } catch (err) {
    logger.warn('booking_charges_load_failed', { message: err?.message });
    return null;
  }
}

async function getBookingChargesMap({ useCache = true } = {}) {
  if (useCache && chargesCache && Date.now() - chargesCacheAt < CACHE_TTL_MS) {
    return chargesCache;
  }

  const rows = await loadActiveChargesRows();
  const map = {};
  for (const row of rows || []) {
    const plain = row.get({ plain: true });
    map[plain.code] = formatChargeRow(plain);
  }

  if (rows === null) {
    for (const [code, amount] of Object.entries(DEFAULT_CHARGE_AMOUNTS)) {
      if (!map[code]) {
        map[code] = {
          code,
          label: code,
          amount: toAmount(amount),
          service_applicability: BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL,
          sort_order: 0,
        };
      }
    }
  }

  chargesCache = map;
  chargesCacheAt = Date.now();
  return map;
}

function filterChargesForServiceType(chargesMap, serviceType) {
  const svc = String(serviceType || '').trim().toLowerCase();
  const filtered = {};
  for (const [code, row] of Object.entries(chargesMap || {})) {
    if (!svc || chargeAppliesToServiceType(row.service_applicability, svc)) {
      filtered[code] = row;
    }
  }
  return filtered;
}

async function listApplicableBookingCharges(serviceType) {
  const map = await getBookingChargesMap();
  return Object.values(filterChargesForServiceType(map, serviceType)).sort(
    (a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)
  );
}

function isCustomCarWashPackageBooking({ serviceType, isCustomPackage }) {
  if (!isCustomPackage) return false;
  const svc = String(serviceType || '').trim().toLowerCase();
  return svc === 'car_wash' || svc === 'combo';
}

/**
 * Fixed CarComfort service fee for customer-entered (custom) car wash packages.
 * Inactive in admin → $0. Preset packages are never charged this fee.
 */
async function resolveCustomCarWashServiceFee({ serviceType, isCustomPackage }) {
  const code = BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE;
  const label = BOOKING_CHARGE_LABELS[code] || 'CarComfort service fee';
  if (!isCustomCarWashPackageBooking({ serviceType, isCustomPackage })) {
    return { code, label, amount: 0 };
  }

  const amount = await getBookingChargeAmount(code, 0, { serviceType });
  return { code, label, amount: toAmount(amount) };
}

async function getBookingChargeAmount(code, fallback = 0, { serviceType } = {}) {
  try {
    const map = await getBookingChargesMap();
    const row = map[code];
    if (!row) return 0;
    if (serviceType && !chargeAppliesToServiceType(row.service_applicability, serviceType)) {
      return 0;
    }
    return row.amount;
  } catch (err) {
    logger.warn('booking_charge_amount_failed', { code, message: err?.message });
    return fallback;
  }
}

/**
 * Fees applied during booking pricing (review/confirm).
 */
async function resolveBookingPricingFees({
  scheduleType,
  serviceType,
  applyTowingFee = false,
} = {}) {
  const map = filterChargesForServiceType(await getBookingChargesMap(), serviceType);

  const convenience_fee = map[BOOKING_CHARGE_CODES.CONVENIENCE_FEE]?.amount ?? 0;
  const normalizedScheduleType = String(scheduleType || '').trim().toLowerCase();
  const on_demand_fee =
    normalizedScheduleType === 'on_demand' || normalizedScheduleType === 'on-demand'
      ? map[BOOKING_CHARGE_CODES.ON_DEMAND_SERVICES]?.amount ?? 0
      : 0;
  const towing_fee = applyTowingFee
    ? map[BOOKING_CHARGE_CODES.TOWING_SERVICES]?.amount ?? 0
    : 0;

  const extra_fees = [];
  for (const [code, row] of Object.entries(map)) {
    if (PRICING_CHARGE_CODES.has(code)) continue;
    if (
      code === BOOKING_CHARGE_CODES.CUSTOMER_CANCELLATION_FEE ||
      code === BOOKING_CHARGE_CODES.CUSTOMER_NO_SHOW_FEE ||
      code === BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE
    ) {
      continue;
    }
    if (row.amount > 0) {
      extra_fees.push({
        code: row.code,
        label: row.label,
        amount: row.amount,
        service_applicability: row.service_applicability,
      });
    }
  }

  const extra_fees_total = extra_fees.reduce((sum, row) => sum + row.amount, 0);

  return {
    convenience_fee,
    on_demand_fee,
    towing_fee,
    extra_fees,
    booking_charges_total: convenience_fee + on_demand_fee + towing_fee + extra_fees_total,
  };
}

async function getCustomerCancellationFeeAmount(fallback = 0, options = {}) {
  return getBookingChargeAmount(CUSTOMER_CANCELLATION_FEE_CODE, fallback, options);
}

async function getCustomerNoShowFeeAmount(fallback = 0, options = {}) {
  return getBookingChargeAmount(CUSTOMER_NO_SHOW_FEE_CODE, fallback, options);
}

module.exports = {
  BOOKING_CHARGE_CODES,
  PRICING_CHARGE_CODES,
  clearBookingChargesCache,
  getBookingChargesMap,
  listApplicableBookingCharges,
  getBookingChargeAmount,
  isCustomCarWashPackageBooking,
  resolveCustomCarWashServiceFee,
  resolveBookingPricingFees,
  getCustomerCancellationFeeAmount,
  getCustomerNoShowFeeAmount,
  chargeAppliesToServiceType,
};
