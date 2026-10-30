'use strict';

const FUEL_TYPE_OPTIONS = ['GAS', 'DIESEL', 'ELECTRIC'];

/** @deprecated Legacy value stored before GAS/DIESEL split */
const LEGACY_FUEL_TYPE_OTHER = 'OTHER';

function normalizeFuelType(value, { defaultValue = null } = {}) {
  const raw =
    value === null || value === undefined || String(value).trim() === ''
      ? defaultValue
      : String(value).trim().toUpperCase();
  if (!raw) return null;
  if (raw === LEGACY_FUEL_TYPE_OTHER) return 'GAS';
  return FUEL_TYPE_OPTIONS.includes(raw) ? raw : null;
}

function isElectricFuelType(fuelType) {
  return String(fuelType || '').toUpperCase() === 'ELECTRIC';
}

function fuelTypeValidationMessage() {
  return `fuel_type must be one of: ${FUEL_TYPE_OPTIONS.join(', ')}`;
}

module.exports = {
  FUEL_TYPE_OPTIONS,
  LEGACY_FUEL_TYPE_OTHER,
  normalizeFuelType,
  isElectricFuelType,
  fuelTypeValidationMessage,
};
