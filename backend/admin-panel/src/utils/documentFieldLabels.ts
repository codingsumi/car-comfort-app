const DRIVER_DOCUMENT_LABELS: Record<string, string> = {
  drivers_license_front: "Driver's License (Front)",
  drivers_license_back: "Driver's License (Back)",
  insurance_card_front: 'Insurance Card (Front)',
  insurance_card_back: 'Insurance Card (Back)',
  vehicle_registration_front: 'Vehicle Registration (Front)',
  vehicle_registration_back: 'Vehicle Registration (Back)',
  background_check_signed_form: 'Background Check (Signed PDF)',
  profile_picture: 'Profile Picture',
};

/** Human-readable name for an onboarding document field key. */
export function documentFieldLabel(key: string): string {
  const mapped = DRIVER_DOCUMENT_LABELS[key];
  if (mapped) return mapped;
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
