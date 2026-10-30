'use strict';

const db = require('../models');
const {
  resolveBookingPricingFees,
  resolveCustomCarWashServiceFee,
} = require('./bookingCharges.service');
const { calcPricingWithReferralDiscount } = require('./referralDiscount.service');
const { findActivePromotion, calcPromotionalDiscountAmount } = require('./promotionalDiscount.service');
const { getTaxPercent } = require('./pricing.service');
const {
  resolveProviderCompensationFromPackage,
  resolveComboProviderCompensationAmount,
  pickComboCompensationPackageRow,
  isOnDemandSchedule,
  formatProviderCompensationLabel,
} = require('../utils/providerCompensation');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sumAddonPrices(addons) {
  return roundTwo(
    (addons || []).reduce((sum, row) => sum + toAmount(row?.price), 0)
  );
}

function isCustomPackageBooking(booking) {
  return !booking?.package_id && booking?.custom_price != null && booking.custom_price !== '';
}

function packageServiceName(packageRow) {
  return String(packageRow?.service?.name || packageRow?.Service?.name || '').trim().toLowerCase();
}

function formatEstimatedPaidAtValue() {
  return formatUsdAmount(0);
}

function formatUsdAmount(amount) {
  const n = toAmount(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

async function resolveVehicleTypeCharge(vehicleTypeName) {
  const normalized = String(vehicleTypeName || '').trim();
  if (!normalized) return 0;

  const rows = await db.VehicleType.findAll({
    where: { status: 'active' },
    attributes: ['name', 'charges'],
  });

  const match = rows.find((r) => String(r.name).toLowerCase() === normalized.toLowerCase());
  return roundTwo(match?.charges ?? 0);
}

async function resolveEvChargingPackageRow({ packageRow } = {}) {
  if (packageRow && packageServiceName(packageRow) === 'ev_charging') {
    return packageRow;
  }

  const row = await db.Package.findOne({
    where: { is_active: true },
    include: [
      {
        model: db.Service,
        as: 'service',
        where: { name: 'ev_charging' },
        required: true,
        attributes: ['id', 'name'],
      },
    ],
    order: [['id', 'ASC']],
  });

  return row ? row.get({ plain: true }) : null;
}

async function resolveCarWashPackageRow({ packageRow } = {}) {
  if (packageRow && packageServiceName(packageRow) === 'car_wash') {
    return packageRow;
  }

  const row = await db.Package.findOne({
    where: { is_active: true },
    include: [
      {
        model: db.Service,
        as: 'service',
        where: { name: 'car_wash' },
        required: true,
        attributes: [
          'id',
          'name',
        ],
      },
    ],
    order: [['id', 'ASC']],
    attributes: [
      'id',
      'name',
      'base_price',
      'duration_minutes',
      'provider_compensation_type',
      'provider_compensation_value',
      'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value',
    ],
  });

  return row ? row.get({ plain: true }) : null;
}

function resolveEvServiceFeeAmount({ booking, packageRow, evPackageRow }) {
  if (packageServiceName(packageRow) === 'ev_charging') {
    return roundTwo(packageRow?.base_price ?? 0);
  }
  return roundTwo(evPackageRow?.base_price ?? 0);
}

function resolveCarWashPackageAmount({ booking, packageRow, isCustom }) {
  if (!isCustom && packageServiceName(packageRow) === 'combo') {
    return roundTwo(packageRow?.base_price ?? 0);
  }
  if (isCustom) return roundTwo(booking.custom_price);
  return roundTwo(packageRow?.base_price ?? 0);
}

function resolveCarWashPackageLabel({ booking, packageRow, isCustom }) {
  if (isCustom) {
    return String(booking.custom_package_name || 'Custom package').trim() || 'Custom package';
  }
  return String(packageRow?.name || 'Package').trim() || 'Package';
}

async function resolveComboServicePackageRow({ packageRow } = {}) {
  if (packageRow && packageServiceName(packageRow) === 'combo') {
    return packageRow;
  }

  const row = await db.Package.findOne({
    where: { is_active: true },
    include: [
      {
        model: db.Service,
        as: 'service',
        where: { name: 'combo' },
        required: true,
        attributes: ['id', 'name'],
      },
    ],
    order: [['id', 'ASC']],
    attributes: [
      'id',
      'name',
      'base_price',
      'duration_minutes',
      'provider_compensation_type',
      'provider_compensation_value',
      'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value',
    ],
  });

  return row ? row.get({ plain: true }) : null;
}

async function resolveProviderCompensationForBooking({
  booking,
  pricing,
  packageRow,
  evPackageRow,
  comboPackageRow,
  scheduleType,
  serviceType,
}) {
  if (!pricing) return null;
  if (toAmount(pricing.provider_compensation_amount) > 0) {
    const svc = String(serviceType || '').trim();
    const comboPkg = pickComboCompensationPackageRow(packageRow, comboPackageRow);
    if (svc === 'combo' && comboPkg) {
      const catalogAmount = resolveComboProviderCompensationAmount({
        booking: booking || {},
        comboPackageRow: comboPkg,
        scheduleType,
        basePrice: comboPkg.base_price,
      });
      if (catalogAmount > 0 && roundTwo(catalogAmount) !== roundTwo(pricing.provider_compensation_amount)) {
        return {
          amount: roundTwo(catalogAmount),
          compensationType: comboPkg.provider_compensation_type,
          compensationValue: comboPkg.provider_compensation_value,
          selectedCompensationType: isOnDemandSchedule(scheduleType)
            ? comboPkg.on_demand_provider_compensation_type ?? comboPkg.provider_compensation_type
            : comboPkg.provider_compensation_type,
          selectedCompensationValue: isOnDemandSchedule(scheduleType)
            ? comboPkg.on_demand_provider_compensation_value ?? comboPkg.provider_compensation_value
            : comboPkg.provider_compensation_value,
        };
      }
    }
    return {
      amount: roundTwo(pricing.provider_compensation_amount),
      compensationType: pricing.provider_compensation_type,
      compensationValue: pricing.provider_compensation_value,
      selectedCompensationType: pricing.provider_compensation_type,
      selectedCompensationValue: pricing.provider_compensation_value,
    };
  }

  const svc = String(serviceType || '').trim();
  const comboPkg = pickComboCompensationPackageRow(packageRow, comboPackageRow);
  if (svc === 'combo' && comboPkg) {
    const amount = resolveComboProviderCompensationAmount({
      booking: booking || {},
      comboPackageRow: comboPkg,
      scheduleType,
      basePrice: comboPkg.base_price,
    });
    if (amount <= 0) return null;
    return {
      amount,
      compensationType: comboPkg.provider_compensation_type,
      compensationValue: comboPkg.provider_compensation_value,
      selectedCompensationType: isOnDemandSchedule(scheduleType)
        ? comboPkg.on_demand_provider_compensation_type ?? comboPkg.provider_compensation_type
        : comboPkg.provider_compensation_type,
      selectedCompensationValue: isOnDemandSchedule(scheduleType)
        ? comboPkg.on_demand_provider_compensation_value ?? comboPkg.provider_compensation_value
        : comboPkg.provider_compensation_value,
    };
  }

  const compPackage =
    svc === 'ev_charging'
      ? packageServiceName(packageRow) === 'ev_charging'
        ? packageRow
        : evPackageRow
      : packageRow;

  // Custom-package bookings have no packageRow; fall back to the default
  // car-wash package compensation so earnings are not shown as $0.
  const isCustom = isCustomPackageBooking(booking);
  if (!compPackage) {
    if (isCustom && svc === 'car_wash') {
      const fallback = await resolveCarWashPackageRow({ packageRow: null });
      if (!fallback) return null;
      const providerCompFallback = resolveProviderCompensationFromPackage({
        packageRow: fallback,
        scheduleType,
        basePrice: pricing.base_price,
      });
      if (providerCompFallback.amount <= 0) return null;
      return {
        amount: providerCompFallback.amount,
        compensationType: providerCompFallback.compensationType,
        compensationValue: providerCompFallback.compensationValue,
        selectedCompensationType: providerCompFallback.selectedCompensationType,
        selectedCompensationValue: providerCompFallback.selectedCompensationValue,
      };
    }
    return null;
  }

  const providerComp = resolveProviderCompensationFromPackage({
    packageRow: compPackage,
    scheduleType,
    basePrice: pricing.base_price,
  });
  if (providerComp.amount <= 0) return null;

  return {
    amount: providerComp.amount,
    compensationType: providerComp.compensationType,
    compensationValue: providerComp.compensationValue,
    selectedCompensationType: providerComp.compensationType,
    selectedCompensationValue: providerComp.compensationValue,
  };
}

/**
 * Shared line-item builder aligned with client billing summary structure.
 */
async function buildCustomerPriceSummaryLines({
  booking,
  packageRow,
  evPackageRow,
  addons,
  vehicle,
  pricing,
  scheduleType,
}) {
  const serviceType = String(booking.service_type || '').trim();
  const isCustom = isCustomPackageBooking(booking);
  const isEvOnly = serviceType === 'ev_charging';
  const isCarWash = serviceType === 'car_wash';
  const isCombo = serviceType === 'combo';

  const carWashPackageName = resolveCarWashPackageLabel({ booking, packageRow, isCustom });
  const carWashAmount =
    isCarWash || isCombo ? resolveCarWashPackageAmount({ booking, packageRow, isCustom }) : 0;
  const evServiceFeeAmount =
    isEvOnly || isCombo ? resolveEvServiceFeeAmount({ booking, packageRow, evPackageRow }) : 0;

  const detailingAmount = sumAddonPrices(addons);
  const vehicleTypeName = String(
    vehicle?.vehicle_type || vehicle?.vehicleType || 'Sedan'
  ).trim();
  const vehicleAmount =
    isEvOnly ? 0 : await resolveVehicleTypeCharge(vehicleTypeName);

  const bookingFees = await resolveBookingPricingFees({
    scheduleType,
    serviceType,
  });
  const convenienceAmount = roundTwo(
    pricing?.convenience_fee != null ? pricing.convenience_fee : bookingFees.convenience_fee
  );
  const onDemandAmount = roundTwo(
    pricing?.on_demand_fee != null ? pricing.on_demand_fee : bookingFees.on_demand_fee
  );
  const towingAmount = roundTwo(
    pricing?.towing_fee != null ? pricing.towing_fee : bookingFees.towing_fee
  );

  const customCarWashFee = await resolveCustomCarWashServiceFee({
    serviceType,
    isCustomPackage: isCustom,
  });
  const carComfortServiceFee =
    customCarWashFee.amount > 0
      ? roundTwo(customCarWashFee.amount)
      : roundTwo(toAmount(pricing?.service_fee) + toAmount(pricing?.platform_fee));

  const applicableCharges = [];
  const addCharge = (
    key,
    label,
    amount,
    { includeZero = false, sectionTitle = null, valueText = null } = {}
  ) => {
    const value = roundTwo(toAmount(amount));
    if (value > 0 || includeZero) {
      const row = { key, label, amount: value };
      if (sectionTitle) row.section_title = sectionTitle;
      if (valueText) row.value_text = valueText;
      applicableCharges.push(row);
    }
  };

  const sectionTitle = isCustom ? 'Customer preferred package' : 'CarComfort package';

  if (isEvOnly) {
    addCharge('ev_service_fee', 'EV charging service fee', evServiceFeeAmount);
  } else if (isCarWash) {
    addCharge(
      isCustom ? 'customer_preferred_package' : 'package',
      carWashPackageName,
      carWashAmount,
      { sectionTitle }
    );
    if (isCustom && carComfortServiceFee > 0) {
      addCharge(
        customCarWashFee.amount > 0 ? customCarWashFee.code : 'service_fee',
        customCarWashFee.amount > 0 ? customCarWashFee.label : 'CarComfort service fee',
        carComfortServiceFee
      );
    }
  } else if (isCombo) {
    addCharge(
      isCustom ? 'customer_preferred_package' : 'package',
      carWashPackageName,
      carWashAmount,
      { sectionTitle }
    );
    if (isCustom && carComfortServiceFee > 0) {
      addCharge(
        customCarWashFee.amount > 0 ? customCarWashFee.code : 'service_fee',
        customCarWashFee.amount > 0 ? customCarWashFee.label : 'CarComfort service fee',
        carComfortServiceFee
      );
    }
    addCharge('ev_service_fee', 'EV charging service fee', evServiceFeeAmount);
  }

  if (isEvOnly || isCombo) {
    addCharge('estimated_charging_cost', 'Estimated charging cost', 0, {
      includeZero: true,
      valueText: formatUsdAmount(0),
    });
  }

  if (!isEvOnly) {
    if (detailingAmount > 0) {
      addCharge('detailing', 'Interior/exterior detailing fee', detailingAmount);
    }
    if (vehicleAmount > 0) {
      addCharge('vehicle_type', `Vehicle type (${vehicleTypeName})`, vehicleAmount);
    }
  }

  addCharge('convenience', 'Convenience fee', convenienceAmount);
  addCharge('on_demand', 'On-demand service fee', onDemandAmount);
  addCharge('towing', 'Towing fee', towingAmount);

  for (const extra of bookingFees.extra_fees || []) {
    addCharge(extra.code, extra.label, extra.amount);
  }

  if (isCarWash || (isCombo && !isCustom)) {
    addCharge('estimated_car_wash_fee', 'Estimated car wash fee', 0, {
      includeZero: true,
      valueText: formatEstimatedPaidAtValue(),
    });
  }

  const subtotalBeforeTax = roundTwo(
    applicableCharges.reduce((sum, line) => sum + toAmount(line.amount), 0)
  );
  addCharge('subtotal', 'Subtotal', subtotalBeforeTax);

  const taxPercent = toAmount(pricing?.tax_percent) || (await getTaxPercent());
  const referralDiscountAmount = roundTwo(toAmount(pricing?.referral_discount_amount));
  const promoDiscountAmount = roundTwo(toAmount(pricing?.promotional_discount_amount));
  const discountAmount = roundTwo(referralDiscountAmount + promoDiscountAmount);

  if (discountAmount > 0) {
    applicableCharges.push({
      key: 'discount_promotion',
      label: promoDiscountAmount > 0
        ? (pricing?.promotional_discount_name ? `Promo: ${pricing.promotional_discount_name}` : 'Promotional discount')
        : 'Discount and savings',
      amount: -discountAmount,
    });
  }

  const taxAmount = roundTwo((subtotalBeforeTax * taxPercent) / 100);
  addCharge('tax', 'Taxes', taxAmount);

  const total = roundTwo(Math.max(0, subtotalBeforeTax + taxAmount - discountAmount));

  return {
    applicableCharges,
    subtotalBeforeTax,
    taxAmount,
    discountAmount,
    total,
  };
}

/**
 * Customer-facing price summary (review / confirm screens).
 */
async function buildBookingPriceSummary({
  booking,
  packageRow,
  evPackageRow,
  comboPackageRow,
  addons,
  vehicle,
  pricing,
  scheduleType,
}) {
  const resolvedEvPackage =
    evPackageRow ??
    (['ev_charging', 'combo'].includes(String(booking.service_type || ''))
      ? await resolveEvChargingPackageRow({ packageRow })
      : null);

  const resolvedComboPackage =
    comboPackageRow ??
    (String(booking.service_type || '').trim() === 'combo'
      ? await resolveComboServicePackageRow({ packageRow })
      : null);

  const { applicableCharges, total } = await buildCustomerPriceSummaryLines({
    booking,
    packageRow,
    evPackageRow: resolvedEvPackage,
    addons,
    vehicle,
    pricing,
    scheduleType,
  });

  const providerComp = await resolveProviderCompensationForBooking({
    booking,
    pricing,
    packageRow,
    evPackageRow: resolvedEvPackage,
    comboPackageRow: resolvedComboPackage,
    scheduleType,
    serviceType: booking.service_type,
  });

  return {
    title: 'CarComfort Price Summary',
    applicable_charges: applicableCharges,
    provider_compensation: formatProviderCompensationForApi(providerComp),
    total,
  };
}

function formatProviderCompensationForApi(providerComp) {
  if (!providerComp || toAmount(providerComp.amount) <= 0) return null;
  const type = providerComp.selectedCompensationType ?? providerComp.compensationType;
  const value = providerComp.selectedCompensationValue ?? providerComp.compensationValue;
  return {
    type,
    value,
    amount: roundTwo(providerComp.amount),
    label: formatProviderCompensationLabel({ compensationType: type, compensationValue: value }),
  };
}

async function applyProviderCompensationToPricing(pricing, {
  booking,
  packageRow,
  evPackageRow,
  comboPackageRow,
  scheduleType,
  serviceType,
}) {
  if (!pricing) return pricing;
  if (toAmount(pricing.provider_compensation_amount) > 0) {
    const svc = String(serviceType || '').trim();
    const comboPkg = pickComboCompensationPackageRow(packageRow, comboPackageRow);
    if (svc === 'combo' && comboPkg) {
      const providerComp = await resolveProviderCompensationForBooking({
        booking,
        pricing: { ...pricing, provider_compensation_amount: 0 },
        packageRow,
        evPackageRow,
        comboPackageRow: comboPkg,
        scheduleType,
        serviceType,
      });
      if (providerComp?.amount > 0) {
        return {
          ...pricing,
          provider_compensation_type: providerComp.compensationType,
          provider_compensation_value: providerComp.compensationValue,
          provider_compensation_amount: providerComp.amount,
          on_demand_provider_compensation_type:
            pricing.on_demand_provider_compensation_type ?? null,
          on_demand_provider_compensation_value:
            pricing.on_demand_provider_compensation_value ?? null,
          on_demand_provider_compensation_amount:
            pricing.on_demand_provider_compensation_amount ?? null,
        };
      }
    }
    return pricing;
  }

  const providerComp = await resolveProviderCompensationForBooking({
    booking,
    pricing,
    packageRow,
    evPackageRow,
    comboPackageRow,
    scheduleType,
    serviceType,
  });
  if (!providerComp || providerComp.amount <= 0) return pricing;

  return {
    ...pricing,
    provider_compensation_type: providerComp.compensationType,
    provider_compensation_value: providerComp.compensationValue,
    provider_compensation_amount: providerComp.amount,
    on_demand_provider_compensation_type: pricing.on_demand_provider_compensation_type ?? null,
    on_demand_provider_compensation_value: pricing.on_demand_provider_compensation_value ?? null,
    on_demand_provider_compensation_amount: pricing.on_demand_provider_compensation_amount ?? null,
  };
}

/**
 * Pricing base: package/custom + EV service fee + addons + vehicle (no vehicle on EV-only).
 */
async function resolveBookingPricingBase({ booking, packageRow, evPackageRow, addons, vehicle }) {
  const isCustom = isCustomPackageBooking(booking);
  const serviceType = String(booking.service_type || '').trim();
  const addonAmount = sumAddonPrices(addons);
  const needsVehicle = serviceType !== 'ev_charging';
  const vehicleAmount = needsVehicle
    ? await resolveVehicleTypeCharge(vehicle?.vehicle_type || vehicle?.vehicleType)
    : 0;

  const resolvedEvPackage =
    evPackageRow ??
    (['ev_charging', 'combo'].includes(serviceType)
      ? await resolveEvChargingPackageRow({ packageRow })
      : null);

  let packagePortion = 0;
  let carWashAmount = 0;
  let evServiceFeeAmount = 0;

  if (serviceType === 'car_wash') {
    carWashAmount = resolveCarWashPackageAmount({ booking, packageRow, isCustom });
    packagePortion = carWashAmount;
  } else if (serviceType === 'ev_charging') {
    evServiceFeeAmount = resolveEvServiceFeeAmount({
      booking,
      packageRow,
      evPackageRow: resolvedEvPackage,
    });
    packagePortion = evServiceFeeAmount;
  } else if (serviceType === 'combo') {
    carWashAmount = resolveCarWashPackageAmount({ booking, packageRow, isCustom });
    evServiceFeeAmount = roundTwo(resolvedEvPackage?.base_price ?? 0);
    packagePortion = roundTwo(carWashAmount + evServiceFeeAmount);
  }

  const base = roundTwo(packagePortion + addonAmount + vehicleAmount);

  return {
    base,
    packageAmount: packagePortion,
    carWashAmount,
    evServiceFeeAmount,
    isCustom,
    evPackageRow: resolvedEvPackage,
  };
}

async function calcCustomerBookingPricing({
  booking,
  packageRow,
  evPackageRow,
  addons,
  vehicle,
  userId,
  excludeBookingId,
  scheduleType,
  applyTowingFee,
  transaction,
}) {
  const {
    base,
    isCustom,
    evPackageRow: resolvedEvPackage,
  } = await resolveBookingPricingBase({
    booking,
    packageRow,
    evPackageRow,
    addons,
    vehicle,
  });

  const serviceType = booking.service_type;

  const customCarWashFee = await resolveCustomCarWashServiceFee({
    serviceType,
    isCustomPackage: isCustom,
  });

  const referralPricing = await calcPricingWithReferralDiscount({
    basePrice: base,
    userId,
    excludeBookingId,
    scheduleType,
    serviceType,
    applyTowingFee,
    transaction,
  });

  const bookingFees = await resolveBookingPricingFees({
    scheduleType,
    serviceType: booking.service_type,
    applyTowingFee,
  });
  const convenienceAmount = roundTwo(bookingFees.convenience_fee);
  const onDemandAmount = roundTwo(bookingFees.on_demand_fee);
  const towingAmount = roundTwo(bookingFees.towing_fee);
  const extraFeesTotal = roundTwo(bookingFees.extra_fees_total || 0);

  const carComfortServiceFee = isCustom ? roundTwo(customCarWashFee.amount) : 0;
  const serviceFee = carComfortServiceFee;
  const platformFee = 0;

  const providerComp = await resolveProviderCompensationForBooking({
    booking,
    pricing: { base_price: base, provider_compensation_amount: 0 },
    packageRow,
    evPackageRow: resolvedEvPackage,
    scheduleType,
    serviceType,
  }) || { amount: 0, compensationType: 'percentage', compensationValue: 0 };

  const subtotalBeforeTax = roundTwo(
    base + convenienceAmount + onDemandAmount + towingAmount + extraFeesTotal + serviceFee + platformFee
  );

  // Find the best active promotional discount now that we have the real subtotal,
  // so percentage vs flat promos are compared on actual dollar savings.
  const activePromo = await findActivePromotion({
    serviceType: booking.service_type,
    userId,
    subtotal: subtotalBeforeTax,
  });

  const taxPercent = toAmount(referralPricing.tax_percent) || (await getTaxPercent());
  const taxAmount = roundTwo((subtotalBeforeTax * taxPercent) / 100);
  const referralDiscountAmount = roundTwo(toAmount(referralPricing.referral_discount_amount));

  // Compute promotional discount on the subtotal (before tax)
  const promoDiscountAmount = activePromo
    ? roundTwo(calcPromotionalDiscountAmount(activePromo, subtotalBeforeTax))
    : 0;
  const discountAmount = roundTwo(referralDiscountAmount + promoDiscountAmount);

  const totalPrice = roundTwo(Math.max(0, subtotalBeforeTax + taxAmount - discountAmount));

  return {
    base_price_before_discount: roundTwo(base + discountAmount),
    base_price: roundTwo(base),
    provider_compensation_type: providerComp.compensationType,
    provider_compensation_value: providerComp.compensationValue,
    provider_compensation_amount: providerComp.amount,
    on_demand_provider_compensation_type: null,
    on_demand_provider_compensation_value: null,
    on_demand_provider_compensation_amount: null,
    service_fee: serviceFee,
    service_fee_percent: 0,
    platform_fee: platformFee,
    platform_fee_percent: 0,
    carcomfort_service_fee: carComfortServiceFee,
    convenience_fee: convenienceAmount,
    on_demand_fee: onDemandAmount,
    towing_fee: towingAmount,
    extra_fees: bookingFees.extra_fees || [],
    extra_fees_total: extraFeesTotal,
    tax: taxAmount,
    tax_percent: taxPercent,
    subtotal_before_referral: roundTwo(subtotalBeforeTax + taxAmount),
    total_price: totalPrice,
    referral_discount_percent: roundTwo(toAmount(referralPricing.referral_discount_percent)),
    referral_discount_amount: referralDiscountAmount,
    promotional_discount_id: activePromo?.id ?? null,
    promotional_discount_name: activePromo?.name ?? null,
    promotional_discount_type: activePromo?.discount_type ?? null,
    promotional_discount_value: activePromo ? Number(activePromo.discount_value) : null,
    promotional_discount_amount: promoDiscountAmount,
    ev_package_row: resolvedEvPackage,
  };
}

function pricingSnapshotFromBooking(booking) {
  return {
    base_price: booking.base_price,
    addon_price: booking.addon_price,
    service_fee: booking.service_fee,
    platform_fee: booking.platform_fee,
    convenience_fee: booking.convenience_fee,
    on_demand_fee: booking.on_demand_fee,
    towing_fee: booking.towing_fee,
    tax: booking.tax,
    tax_percent: booking.tax_percent,
    referral_discount_amount: booking.referral_discount_amount,
    referral_discount_percent: booking.referral_discount_percent,
    total_price: booking.total_price,
    provider_compensation_amount: booking.provider_compensation_amount,
    provider_compensation_type: booking.provider_compensation_type,
    provider_compensation_value: booking.provider_compensation_value,
    on_demand_provider_compensation_amount: booking.on_demand_provider_compensation_amount,
    on_demand_provider_compensation_type: booking.on_demand_provider_compensation_type,
    on_demand_provider_compensation_value: booking.on_demand_provider_compensation_value,
  };
}

const PAID_AT_VALUE_TEXT_RE = /\s*\([^)]*paid at[^)]*\)/gi;

function normalizeEstimatedPassThroughValueText(valueText) {
  const raw = String(valueText || '').trim();
  if (!raw) return formatUsdAmount(0);
  const cleaned = raw.replace(PAID_AT_VALUE_TEXT_RE, '').trim();
  if (!cleaned || cleaned === '$0' || cleaned === '0') return formatUsdAmount(0);
  return cleaned;
}

function sanitizeStoredPriceSummaryCharges(charges) {
  if (!Array.isArray(charges)) return charges;
  return charges.map((line) => {
    const key = String(line?.key || '').trim().toLowerCase();
    if (key !== 'estimated_car_wash_fee' && key !== 'estimated_charging_cost') {
      return line;
    }
    const valueText = normalizeEstimatedPassThroughValueText(
      line.value_text ?? line.valueText
    );
    const label = String(line.label || '')
      .replace(PAID_AT_VALUE_TEXT_RE, '')
      .trim();
    return {
      ...line,
      ...(label ? { label } : {}),
      value_text: valueText,
      valueText,
    };
  });
}

/**
 * Keys that must never appear in an EV-only booking's price summary.
 * They may exist in legacy stored snapshots written before the isEvOnly guard
 * was introduced, and must be stripped before returning to clients.
 */
const EV_ONLY_EXCLUDED_CHARGE_KEYS = new Set(['detailing', 'vehicle_type']);

function resolveStoredPriceSummary(bookingPlain) {
  const raw = bookingPlain.price_summary;
  if (!raw || typeof raw !== 'object') return null;

  const charges = raw.applicable_charges || raw.applicableCharges;
  if (!Array.isArray(charges) || charges.length === 0) return null;

  const storedTotal = roundTwo(toAmount(raw.total ?? bookingPlain.total_price));

  let sanitized = sanitizeStoredPriceSummaryCharges(charges);

  // Strip Interior/exterior detailing and vehicle-type charges from EV-only
  // bookings. These should never appear for ev_charging service type but may
  // be present in legacy stored snapshots written before the isEvOnly guard.
  const isEvOnly = String(bookingPlain.service_type || '').trim() === 'ev_charging';
  if (isEvOnly) {
    sanitized = sanitized.filter((line) => {
      const key = String(line?.key || '').trim().toLowerCase();
      return !EV_ONLY_EXCLUDED_CHARGE_KEYS.has(key);
    });
  }

  return {
    title: String(raw.title || 'CarComfort Price Summary').trim() || 'CarComfort Price Summary',
    applicable_charges: sanitized,
    provider_compensation: raw.provider_compensation ?? null,
    total: storedTotal,
  };
}

/**
 * Rebuild price summary from frozen booking amounts (legacy bookings without snapshot).
 */
async function buildAppliedPriceSummaryFromBooking(bookingPlain, { evPackageRow } = {}) {
  const resolvedEvPackage =
    evPackageRow ??
    (['ev_charging', 'combo'].includes(String(bookingPlain.service_type || ''))
      ? await resolveEvChargingPackageRow({ packageRow: bookingPlain.package })
      : null);

  const pricing = pricingSnapshotFromBooking(bookingPlain);
  const effectiveScheduleType = bookingPlain.schedule_type;

  const { applicableCharges, total: computedTotal } = await buildCustomerPriceSummaryLines({
    booking: bookingPlain,
    packageRow: bookingPlain.package,
    evPackageRow: resolvedEvPackage,
    addons: bookingPlain.addons,
    vehicle: bookingPlain.vehicle,
    pricing,
    scheduleType: effectiveScheduleType,
  });

  const storedTotal = roundTwo(toAmount(bookingPlain.total_price));
  const providerComp = await resolveProviderCompensationForBooking({
    booking: bookingPlain,
    pricing,
    packageRow: bookingPlain.package,
    evPackageRow: resolvedEvPackage,
    scheduleType: effectiveScheduleType,
    serviceType: bookingPlain.service_type,
  });

  return {
    title: 'CarComfort Price Summary',
    applicable_charges: applicableCharges,
    provider_compensation: formatProviderCompensationForApi(providerComp),
    total: storedTotal > 0 ? storedTotal : computedTotal,
  };
}

async function resolveBookingDetailPriceSummary(bookingPlain) {
  const stored = resolveStoredPriceSummary(bookingPlain);
  if (stored) return stored;
  return buildAppliedPriceSummaryFromBooking(bookingPlain);
}

function resolveBookingChargedTotal(bookingPlain, { transactionAmount } = {}) {
  const summaryTotal = toAmount(bookingPlain?.price_summary?.total);
  if (summaryTotal > 0) return roundTwo(summaryTotal);

  const storedTotal = toAmount(bookingPlain?.total_price);
  const txnTotal = toAmount(transactionAmount);

  if (txnTotal > 0) {
    if (storedTotal <= 0 || Math.abs(txnTotal - storedTotal) > 0.02) {
      return roundTwo(txnTotal);
    }
  }

  if (storedTotal > 0) return roundTwo(storedTotal);
  if (txnTotal > 0) return roundTwo(txnTotal);
  return null;
}

function syncPricingTotalsFromPriceSummary(pricing, priceSummary) {
  if (!pricing || !priceSummary) return pricing;

  const chargedTotal = roundTwo(toAmount(priceSummary.total));
  if (chargedTotal > 0) {
    pricing.total_price = chargedTotal;
  }

  const taxLine = (priceSummary.applicable_charges || []).find(
    (line) => String(line?.key || '').trim().toLowerCase() === 'tax'
  );
  if (taxLine) {
    pricing.tax = roundTwo(toAmount(taxLine.amount));
  }

  return pricing;
}

async function buildBookingPriceSummaryFromStoredBooking(bookingPlain) {
  return buildAppliedPriceSummaryFromBooking(bookingPlain);
}

module.exports = {
  buildBookingPriceSummary,
  buildAppliedPriceSummaryFromBooking,
  resolveStoredPriceSummary,
  resolveBookingDetailPriceSummary,
  resolveBookingChargedTotal,
  formatUsdAmount,
  syncPricingTotalsFromPriceSummary,
  buildBookingPriceSummaryFromStoredBooking,
  calcCustomerBookingPricing,
  applyProviderCompensationToPricing,
  formatProviderCompensationForApi,
  resolveBookingPricingBase,
  resolveEvChargingPackageRow,
  resolveCarWashPackageRow,
  resolveComboServicePackageRow,
  resolveVehicleTypeCharge,
  sumAddonPrices,
};
