'use strict';

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCompensationType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'fixed' ? 'fixed' : 'percentage';
}

function computeProviderCompensationAmount({
  basePrice,
  compensationType,
  compensationValue,
}) {
  const base = toAmount(basePrice);
  const value = toAmount(compensationValue);
  const type = normalizeCompensationType(compensationType);

  if (type === 'fixed') {
    return roundTwo(Math.max(0, value));
  }

  return roundTwo(Math.max(0, (base * value) / 100));
}

/**
 * Resolve compensation type/value from package for a schedule (on-demand uses package override when set).
 */
function resolveProviderCompensationFromPackage({ packageRow, scheduleType, basePrice }) {
  if (!packageRow) {
    return {
      compensationType: 'percentage',
      compensationValue: 0,
      amount: 0,
      onDemandCompensationType: null,
      onDemandCompensationValue: null,
      onDemandAmount: null,
    };
  }

  const schedule = String(scheduleType || '').trim().toLowerCase();
  const isOnDemand = schedule === 'on_demand' || schedule === 'asap';

  const compensationType = normalizeCompensationType(packageRow.provider_compensation_type);
  const compensationValue = toAmount(packageRow.provider_compensation_value ?? 100);
  const onDemandCompensationValue =
    packageRow.on_demand_provider_compensation_value != null
      ? toAmount(packageRow.on_demand_provider_compensation_value)
      : null;
  const onDemandCompensationType =
    packageRow.on_demand_provider_compensation_type != null
      ? normalizeCompensationType(packageRow.on_demand_provider_compensation_type)
      : null;

  const selectedCompensationType =
    isOnDemand && onDemandCompensationType ? onDemandCompensationType : compensationType;
  const selectedCompensationValue =
    isOnDemand && onDemandCompensationValue != null
      ? onDemandCompensationValue
      : compensationValue;

  const amount = computeProviderCompensationAmount({
    basePrice,
    compensationType: selectedCompensationType,
    compensationValue: selectedCompensationValue,
  });

  const onDemandAmount =
    isOnDemand && onDemandCompensationValue != null ? amount : null;

  return {
    compensationType,
    compensationValue,
    selectedCompensationType,
    selectedCompensationValue,
    amount,
    onDemandCompensationType,
    onDemandCompensationValue,
    onDemandAmount,
  };
}

function isOnDemandSchedule(scheduleType) {
  const schedule = String(scheduleType || '').trim().toLowerCase();
  return schedule === 'on_demand' || schedule === 'asap';
}

function isCustomPackageBooking(booking) {
  return booking?.package_id == null && toAmount(booking?.custom_price) > 0;
}

function packageServiceName(packageRow) {
  return String(packageRow?.service?.name || packageRow?.Service?.name || '').trim().toLowerCase();
}

/**
 * Combo bookings store the selected car-wash package on `package_id`.
 * Provider payout must use the combo-service package from admin (fixed $90 / $100 etc.).
 */
function pickComboCompensationPackageRow(packageRow, comboPackageRow) {
  if (comboPackageRow && packageServiceName(comboPackageRow) === 'combo') {
    return comboPackageRow;
  }
  if (packageRow && packageServiceName(packageRow) === 'combo') {
    return packageRow;
  }
  return comboPackageRow || null;
}

/**
 * Combo uses its own package provider_compensation_* fields (not wash + EV sums).
 * Scheduled vs on-demand selects the matching column on the combo package row.
 */
function resolveComboProviderCompensationAmount({
  booking,
  comboPackageRow,
  scheduleType,
  basePrice,
}) {
  if (!comboPackageRow) return 0;
  const resolved = resolveProviderCompensationFromPackage({
    packageRow: comboPackageRow,
    scheduleType,
    basePrice: comboPackageRow.base_price ?? booking?.base_price,
  });
  return roundTwo(resolved.amount);
}

/**
 * Effective provider payout for a booking (scheduled vs on-demand from admin package config).
 * Provider compensation is subtracted from platform revenue — never added to the customer bill.
 */
function resolveBookingProviderCompensationAmount(
  booking,
  packageRow = null,
  comboPackageRow = null
) {
  if (!booking) return 0;

  const schedule = booking.schedule_type;
  const pkg = packageRow || booking.package || null;
  const svc = String(booking.service_type || '').trim();
  const comboPkg = pickComboCompensationPackageRow(pkg, comboPackageRow);

  if (svc === 'combo' && comboPkg) {
    const comboAmount = resolveComboProviderCompensationAmount({
      booking,
      comboPackageRow: comboPkg,
      scheduleType: schedule,
      basePrice: comboPkg.base_price,
    });
    if (comboAmount > 0) return comboAmount;
  }

  const onDemandStored = toAmount(booking.on_demand_provider_compensation_amount);
  if (isOnDemandSchedule(schedule) && onDemandStored > 0) {
    return roundTwo(onDemandStored);
  }

  const stored = toAmount(booking.provider_compensation_amount);
  if (stored > 0) return roundTwo(stored);

  if (pkg && svc !== 'combo') {
    const resolved = resolveProviderCompensationFromPackage({
      packageRow: pkg,
      scheduleType: schedule,
      basePrice: booking.base_price,
    });
    if (resolved.amount > 0) return roundTwo(resolved.amount);
  }

  const rawCompValue =
    isOnDemandSchedule(schedule) && booking.on_demand_provider_compensation_value != null
      ? booking.on_demand_provider_compensation_value
      : booking.provider_compensation_value;
  const rawCompType =
    isOnDemandSchedule(schedule) && booking.on_demand_provider_compensation_type
      ? booking.on_demand_provider_compensation_type
      : booking.provider_compensation_type;

  if (rawCompType && rawCompValue != null) {
    return computeProviderCompensationAmount({
      basePrice: booking.base_price,
      compensationType: normalizeCompensationType(rawCompType),
      compensationValue: rawCompValue,
    });
  }

  return 0;
}

function formatProviderCompensationLabel({ compensationType, compensationValue }) {
  const type = normalizeCompensationType(compensationType);
  const value = toAmount(compensationValue);
  if (type === 'fixed') {
    return 'Service provider compensation';
  }
  return `Service provider compensation (${value}%)`;
}

module.exports = {
  roundTwo,
  toAmount,
  normalizeCompensationType,
  isOnDemandSchedule,
  computeProviderCompensationAmount,
  resolveProviderCompensationFromPackage,
  resolveComboProviderCompensationAmount,
  resolveBookingProviderCompensationAmount,
  formatProviderCompensationLabel,
  packageServiceName,
  pickComboCompensationPackageRow,
};

