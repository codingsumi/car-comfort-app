type StepMap = Record<string, Record<string, unknown>>;

function isStepBucket(key: string, value: unknown): value is Record<string, unknown> {
  return /^\d+$/.test(key) && value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Flatten onboarding `step_data` (steps map or legacy shape) into one lookup object. */
export function flattenProviderStepData(
  stepData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!stepData || typeof stepData !== 'object') return {};

  const nested = stepData.steps;
  const buckets: StepMap =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as StepMap)
      : (stepData as StepMap);

  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(buckets)) {
    if (isStepBucket(key, value)) {
      Object.assign(flat, value);
    } else if (value !== null && value !== undefined) {
      flat[key] = value;
    }
  }
  return flat;
}

function pickString(
  flat: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const raw = flat[key];
    if (raw === null || raw === undefined) continue;
    const text = String(raw).trim();
    if (text) return text;
  }
  return null;
}

function formatPhone(countryCode: string | null | undefined, phone: string | null | undefined) {
  const digits = (phone ?? '').trim();
  if (!digits) return null;
  const code = (countryCode ?? '').trim();
  return code ? `${code} ${digits}` : digits;
}

function formatDisplayName(user: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const combined = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (combined) return combined;
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return user.email.trim();
  return '—';
}

function formatDateOfBirth(raw: string) {
  const iso = /^\d{4}-\d{2}-\d{2}/.test(raw);
  if (iso) {
    const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  return raw;
}

function formatSsn(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 9) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export interface ProviderIdentitySummary {
  profilePhoto: string | null;
  name: string;
  dateOfBirth: string | null;
  address: string | null;
  driversLicenseNumber: string | null;
  driversLicenseIssuedDate: string | null;
  driversLicenseExpirationDate: string | null;
  socialSecurityNumber: string | null;
  email: string;
  phone: string | null;
}

export function buildProviderIdentitySummary(
  user: {
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    country_code?: string | null;
  },
  driverProfile?: {
    profile_picture?: string | null;
    step_data?: Record<string, unknown> | null;
  } | null,
): ProviderIdentitySummary {
  const flat = flattenProviderStepData(driverProfile?.step_data ?? null);

  const dobRaw = pickString(flat, [
    'date_of_birth',
    'dob',
    'birth_date',
    'birthdate',
    'dateOfBirth',
  ]);

  const ssnRaw = pickString(flat, [
    'social_security_number',
    'social_security',
    'social_security_no',
    'ssn',
    'socialSecurityNumber',
  ]);

  const addressRaw = pickString(flat, [
    'address',
    'street_address',
    'home_address',
    'mailing_address',
    'residential_address',
  ]);

  const licenseNumberRaw = pickString(flat, [
    'drivers_license_number',
    'driver_license_number',
    'license_number',
  ]);

  const licenseIssuedRaw = pickString(flat, [
    'drivers_license_issued_date',
    'driver_license_issued_date',
    'license_issued_date',
  ]);

  const licenseExpirationRaw = pickString(flat, [
    'drivers_license_expiration_date',
    'driver_license_expiration_date',
    'license_expiration_date',
  ]);

  return {
    profilePhoto: driverProfile?.profile_picture?.trim() || null,
    name: formatDisplayName(user),
    dateOfBirth: dobRaw ? formatDateOfBirth(dobRaw) : null,
    address: addressRaw,
    driversLicenseNumber: licenseNumberRaw,
    driversLicenseIssuedDate: licenseIssuedRaw ? formatDateOfBirth(licenseIssuedRaw) : null,
    driversLicenseExpirationDate: licenseExpirationRaw
      ? formatDateOfBirth(licenseExpirationRaw)
      : null,
    socialSecurityNumber: ssnRaw ? formatSsn(ssnRaw) : null,
    email: user.email?.trim() || '—',
    phone: formatPhone(user.country_code, user.phone),
  };
}
