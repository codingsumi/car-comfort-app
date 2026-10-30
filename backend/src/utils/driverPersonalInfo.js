const { HttpError } = require('./httpError');

const LICENSE_EXPIRED_SUSPENSION_REASON = 'Driver license expired';
const LICENSE_EXPIRY_WARNING_DAYS = 30;
/** Days-before-expiry milestones that trigger provider warnings. */
const LICENSE_EXPIRY_WARNING_MILESTONES = Object.freeze([30, 15, 1, 0]);

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function parseIsoDate(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function validateDateOfBirth(value) {
  const date = parseIsoDate(value);
  if (!date) throw new HttpError(400, 'date_of_birth must be YYYY-MM-DD');

  const today = startOfUtcDay(new Date());
  const minDob = new Date(today);
  minDob.setUTCFullYear(minDob.getUTCFullYear() - 18);
  if (date > minDob) {
    throw new HttpError(400, 'date_of_birth indicates provider must be at least 18 years old');
  }
  return String(value).trim();
}

function validateSocialSecurityNumber(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) {
    throw new HttpError(400, 'social_security_number must be exactly 9 digits');
  }
  return digits;
}

function validateDriversLicenseNumber(value) {
  const val = String(value ?? '').trim();
  if (!val) {
    throw new HttpError(400, 'Please enter your driver license number');
  }
  if (val.length < 4 || val.length > 12) {
    throw new HttpError(400, 'Driver license number must be between 4 and 12 characters');
  }
  if (!/^[a-zA-Z0-9\-.\s/]+$/.test(val)) {
    throw new HttpError(400, 'Driver license number can only contain letters, numbers, dots, hyphens, spaces, or slashes');
  }
  return val;
}

function validateDriversLicenseIssuedDate(value) {
  const date = parseIsoDate(value);
  if (!date) throw new HttpError(400, 'Please enter a valid date issued (YYYY-MM-DD).');

  // Compare whole calendar days so today's date is accepted; only reject dates
  // that fall on a later calendar day than today.
  const today = startOfUtcDay(new Date());
  if (startOfUtcDay(date) > today) {
    throw new HttpError(400, 'Date issued cannot be in the future.');
  }
  return String(value).trim();
}

function validateDriversLicenseExpirationDate(value, issuedDateRaw) {
  const expiration = parseIsoDate(value);
  if (!expiration) throw new HttpError(400, 'Please enter a valid expiration date (YYYY-MM-DD).');

  const issued = parseIsoDate(issuedDateRaw);
  if (issued && startOfUtcDay(expiration) <= startOfUtcDay(issued)) {
    throw new HttpError(400, 'Expiration date must be after the date issued.');
  }
  return String(value).trim();
}

const ADDRESS_REGEX = /^[a-zA-Z0-9\s,'\-./#&()]+$/;
const ADDRESS_MAX_LENGTH = 200;

function normalizeAddress(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function validateAddress(value) {
  const address = normalizeAddress(value);
  if (!address) throw new HttpError(400, 'Please enter address');
  if (address.length > ADDRESS_MAX_LENGTH) {
    throw new HttpError(400, `Address must be at most ${ADDRESS_MAX_LENGTH} characters`);
  }
  if (!ADDRESS_REGEX.test(address)) {
    throw new HttpError(400, 'Address must not contain special characters');
  }
  return address;
}

function pickLicenseExpirationFromStepData(profile) {
  const stepData = profile?.step_data || {};
  const nested = stepData.steps && typeof stepData.steps === 'object' ? stepData.steps : {};
  const step3 = nested['3'] || stepData['3'] || {};
  const raw =
    step3.drivers_license_expiration_date ||
    step3.license_expiration_date ||
    step3.drivers_license_expiry;
  return parseIsoDate(raw);
}

function daysUntilExpiration(expirationDate) {
  if (!expirationDate) return null;
  const today = startOfUtcDay(new Date());
  const expiry = startOfUtcDay(expirationDate);
  return Math.floor((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function isLicenseExpired(expirationDate) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days < 0;
}

function isLicenseExpiringSoon(expirationDate, withinDays = LICENSE_EXPIRY_WARNING_DAYS) {
  const days = daysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= withinDays;
}

module.exports = {
  LICENSE_EXPIRED_SUSPENSION_REASON,
  LICENSE_EXPIRY_WARNING_DAYS,
  LICENSE_EXPIRY_WARNING_MILESTONES,
  digitsOnly,
  parseIsoDate,
  validateDateOfBirth,
  validateSocialSecurityNumber,
  validateDriversLicenseNumber,
  validateDriversLicenseIssuedDate,
  validateDriversLicenseExpirationDate,
  validateAddress,
  pickLicenseExpirationFromStepData,
  daysUntilExpiration,
  isLicenseExpired,
  isLicenseExpiringSoon,
};
