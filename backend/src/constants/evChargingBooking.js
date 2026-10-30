'use strict';

const EV_CHARGER_TYPES = [
  {
    value: 'tesla_supercharger',
    label: 'Tesla Supercharger',
  },
  {
    value: 'dc_fast_charger',
    label: 'DC Fast Charger',
  },
];

const EV_BATTERY_STATUS_LABELS = [
  '0-5%',
  '6%',
  '7%',
  '8%',
  '9%',
  '10%',
  '11%',
  '12%',
  '13%',
  '14%',
  '15%',
  '16%',
  '17%',
  '18%',
  '19%',
  '20%',
  '21-25%',
  '25-30%',
  '30-40%',
  '40-50%',
  '50%',
  'Above',
];

const EV_BATTERY_STATUS_OPTIONS = [
  { value: '0_5', label: '0-5%', percentForPricing: 3 },
  { value: '6', label: '6%', percentForPricing: 6 },
  { value: '7', label: '7%', percentForPricing: 7 },
  { value: '8', label: '8%', percentForPricing: 8 },
  { value: '9', label: '9%', percentForPricing: 9 },
  { value: '10', label: '10%', percentForPricing: 10 },
  { value: '11', label: '11%', percentForPricing: 11 },
  { value: '12', label: '12%', percentForPricing: 12 },
  { value: '13', label: '13%', percentForPricing: 13 },
  { value: '14', label: '14%', percentForPricing: 14 },
  { value: '15', label: '15%', percentForPricing: 15 },
  { value: '16', label: '16%', percentForPricing: 16 },
  { value: '17', label: '17%', percentForPricing: 17 },
  { value: '18', label: '18%', percentForPricing: 18 },
  { value: '19', label: '19%', percentForPricing: 19 },
  { value: '20', label: '20%', percentForPricing: 20 },
  { value: '21_25', label: '21-25%', percentForPricing: 23 },
  { value: '25_30', label: '25-30%', percentForPricing: 28 },
  { value: '30_40', label: '30-40%', percentForPricing: 35 },
  { value: '40_50', label: '40-50%', percentForPricing: 45 },
  { value: '50', label: '50%', percentForPricing: 50 },
  { value: 'above', label: 'Above', percentForPricing: 75 },
];

const EV_BATTERY_STATUS_LEGACY_ALIASES = {
  '50_plus': 'above',
};

const EV_BATTERY_STATUS_LEGACY_LABELS = {
  '50% or above': 'above',
};

const EV_VEHICLE_CHARGE_LIMIT_OPTIONS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

const EV_CHARGER_TYPE_VALUES = new Set(EV_CHARGER_TYPES.map((item) => item.value));
const EV_BATTERY_STATUS_VALUES = new Set(EV_BATTERY_STATUS_OPTIONS.map((item) => item.value));
const EV_BATTERY_STATUS_BY_VALUE = new Map(EV_BATTERY_STATUS_OPTIONS.map((item) => [item.value, item]));
const EV_BATTERY_PRICING_PERCENTS = new Set(EV_BATTERY_STATUS_OPTIONS.map((item) => item.percentForPricing));
const EV_VEHICLE_CHARGE_LIMIT_SET = new Set(EV_VEHICLE_CHARGE_LIMIT_OPTIONS);

function normalizeEvChargerTypeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (EV_CHARGER_TYPE_VALUES.has(raw)) return raw;

  const lower = raw.toLowerCase();
  if (lower.includes('j1772') || lower.includes('level 2')) return null;
  if (lower.includes('tesla') || lower.includes('supercharger')) return 'tesla_supercharger';
  if (
    lower.includes('dc fast') ||
    lower.includes('ccs') ||
    lower.includes('chademo') ||
    lower.includes('combo 150')
  ) {
    return 'dc_fast_charger';
  }

  return null;
}

function isValidEvChargerType(value) {
  return normalizeEvChargerTypeInput(value) !== null;
}

function isValidEvVehicleChargeLimitPercent(n) {
  return Number.isFinite(n) && EV_VEHICLE_CHARGE_LIMIT_SET.has(n);
}

function resolveEvBatteryStatusFromInput({ statusCode, chargePercent }) {
  let code = statusCode === undefined || statusCode === null ? '' : String(statusCode).trim();
  if (code) {
    code = EV_BATTERY_STATUS_LEGACY_ALIASES[code] || code;
    const option = EV_BATTERY_STATUS_BY_VALUE.get(code);
    if (!option) return null;
    return {
      current_battery_status: option.value,
      current_battery_charge: option.percentForPricing,
      label: option.label,
    };
  }

  if (chargePercent === undefined || chargePercent === null || chargePercent === '') return null;
  const raw = String(chargePercent).trim();
  const legacyLabel = EV_BATTERY_STATUS_LEGACY_LABELS[raw];
  if (legacyLabel) {
    const legacyOption = EV_BATTERY_STATUS_BY_VALUE.get(legacyLabel);
    if (legacyOption) {
      return {
        current_battery_status: legacyOption.value,
        current_battery_charge: legacyOption.percentForPricing,
        label: legacyOption.label,
      };
    }
  }
  const byLabel = EV_BATTERY_STATUS_OPTIONS.find(
    (item) => item.label === raw || item.label === `${raw.replace(/%$/, '')}%`
  );
  if (byLabel) {
    return {
      current_battery_status: byLabel.value,
      current_battery_charge: byLabel.percentForPricing,
      label: byLabel.label,
    };
  }

  const n = Number(chargePercent);
  if (!Number.isFinite(n)) return null;

  const byExactPercent = EV_BATTERY_STATUS_OPTIONS.find(
    (item) => item.percentForPricing === n
  );
  if (byExactPercent) {
    return {
      current_battery_status: byExactPercent.value,
      current_battery_charge: byExactPercent.percentForPricing,
      label: byExactPercent.label,
    };
  }

  return null;
}

function getEvBatteryStatusLabel(statusCode) {
  if (statusCode === undefined || statusCode === null || statusCode === '') return null;
  const code = EV_BATTERY_STATUS_LEGACY_ALIASES[String(statusCode).trim()] || String(statusCode).trim();
  return EV_BATTERY_STATUS_BY_VALUE.get(code)?.label || null;
}

function getEvChargingBookingOptions() {
  return {
    charger_types: EV_CHARGER_TYPES,
    battery_status_options: EV_BATTERY_STATUS_OPTIONS.map(({ value, label }) => ({ value, label })),
    battery_status_labels: [...EV_BATTERY_STATUS_LABELS],
    default_battery_status: { value: '0_5', label: '0-5%' },
    vehicle_charge_limit_options: EV_VEHICLE_CHARGE_LIMIT_OPTIONS.map((value) => ({
      value,
      label: `${value}%`,
    })),
  };
}

module.exports = {
  EV_CHARGER_TYPES,
  EV_BATTERY_STATUS_LABELS,
  EV_BATTERY_STATUS_OPTIONS,
  EV_BATTERY_STATUS_BY_VALUE,
  EV_VEHICLE_CHARGE_LIMIT_OPTIONS,
  EV_CHARGER_TYPE_VALUES,
  EV_BATTERY_STATUS_VALUES,
  EV_VEHICLE_CHARGE_LIMIT_SET,
  EV_BATTERY_PRICING_PERCENTS,
  normalizeEvChargerTypeInput,
  isValidEvChargerType,
  isValidEvVehicleChargeLimitPercent,
  resolveEvBatteryStatusFromInput,
  getEvBatteryStatusLabel,
  getEvChargingBookingOptions,
};
