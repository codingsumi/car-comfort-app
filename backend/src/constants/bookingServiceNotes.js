'use strict';

const VEHICLE_PARKED_LOCATIONS = [
  { value: 'my_garage', label: 'My garage' },
  { value: 'my_driveway', label: 'My driveway' },
  { value: 'parking_lot', label: 'Parking lot' },
  { value: 'street_parking', label: 'Street parking' },
  { value: 'apt_building_parking_garage', label: 'Apt building parking garage' },
  { value: 'other', label: 'Others' }
];

const PROVIDER_PARK_LOCATIONS = [
  { value: 'my_parking_spot', label: 'My parking spot' },
  { value: 'guest_parking', label: 'Guest parking' },
  { value: 'street_parking', label: 'Street parking' },
  { value: 'my_driveway', label: 'My driveway' },
  { value: 'paid_parking', label: 'Paid parking' },
  { value: 'other', label: 'Others' }
];

const VEHICLE_KEY_LOCATIONS = [
  { value: 'handed_in_person', label: 'Key will be handed in person' },
  { value: 'left_in_vehicle', label: 'Key is left in the vehicle' },
  { value: 'shared_electronically', label: 'Key will be shared electronically' },
  { value: 'left_in_mailbox', label: 'Key is left in the mailbox' },
  { value: 'apartment_concierge', label: 'Key is with apartment concierge' },
  { value: 'other', label: 'Others' }
];

const KEY_RETURN_LOCATIONS = [
  { value: 'hand_back_to_customer', label: 'Hand key back to customer' },
  { value: 'leave_in_vehicle', label: 'Leave keys/key fob in vehicle' },
  { value: 'mailbox', label: 'Dropped off in mailbox' },
  { value: 'apartment_concierge', label: 'Dropped off with apartment concierge' },
  { value: 'other', label: 'Others' }
];

const FIELD_SPECS = [
  { key: 'vehicle_parked_location', otherKey: 'vehicle_parked_location_other', options: VEHICLE_PARKED_LOCATIONS },
  { key: 'provider_park_location', otherKey: 'provider_park_location_other', options: PROVIDER_PARK_LOCATIONS },
  { key: 'vehicle_key_location', otherKey: 'vehicle_key_location_other', options: VEHICLE_KEY_LOCATIONS },
  { key: 'key_return_location', otherKey: 'key_return_location_other', options: KEY_RETURN_LOCATIONS }
];

const LEGACY_EV_ACCOUNT_CARD_MARKER = /\[EV_ACCOUNT_CARD_ON_FILE\s*:\s*(YES|NO|TRUE|FALSE)\]/gi;

function resolveEvAccountCardOnFile(booking = {}) {
  if (typeof booking.ev_account_card_on_file === 'boolean') {
    return booking.ev_account_card_on_file;
  }

  const matches = Array.from(String(booking.notes || '').matchAll(LEGACY_EV_ACCOUNT_CARD_MARKER));
  if (!matches.length) return null;
  const value = String(matches[matches.length - 1][1]).toLowerCase();
  return value === 'yes' || value === 'true';
}

function stripLegacyEvAccountCardMarker(notes) {
  if (notes == null) return null;
  const cleaned = String(notes)
    .replace(LEGACY_EV_ACCOUNT_CARD_MARKER, '')
    .replace(/^[\s|,;]+|[\s|,;]+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}

const LABEL_BY_VALUE = new Map();
for (const spec of FIELD_SPECS) {
  for (const opt of spec.options) {
    LABEL_BY_VALUE.set(`${spec.key}:${opt.value}`, opt.label);
  }
}

function normalizeChoice(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function isAllowedChoice(options, value) {
  const normalized = normalizeChoice(value);
  return options.some((o) => o.value === normalized);
}

function resolveChoiceLabel(fieldKey, value, otherText) {
  const normalized = normalizeChoice(value);
  if (!normalized) return null;
  if (normalized === 'other') {
    const other = String(otherText || '').trim();
    return other || 'Others';
  }
  return LABEL_BY_VALUE.get(`${fieldKey}:${normalized}`) || value;
}

function parseServiceNotesBody(body = {}) {
  const out = {};
  for (const spec of FIELD_SPECS) {
    const raw = body[spec.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const value = normalizeChoice(raw);
    if (!isAllowedChoice(spec.options, value)) {
      throw new Error(`${spec.key} is invalid`);
    }
    out[spec.key] = value;
    const otherRaw = body[spec.otherKey];
    const other = otherRaw === undefined || otherRaw === null ? '' : String(otherRaw).trim();
    if (value === 'other' && !other) {
      throw new Error(`${spec.otherKey} is required when ${spec.key} is other`);
    }
    out[spec.otherKey] = value === 'other' ? other : null;
  }
  return out;
}

function formatServiceNotesSummary(booking = {}) {
  const lines = [];
  const add = (question, fieldKey, valueKey, otherKey) => {
    const label = resolveChoiceLabel(fieldKey, booking[valueKey], booking[otherKey]);
    if (label) lines.push(`${question} ${label}`);
  };
  add('Where is the vehicle parked?', 'vehicle_parked_location', 'vehicle_parked_location', 'vehicle_parked_location_other');
  add('Where should our service provider park?', 'provider_park_location', 'provider_park_location', 'provider_park_location_other');
  add('Where is the key?', 'vehicle_key_location', 'vehicle_key_location', 'vehicle_key_location_other');
  add('Where should our provider leave the key?', 'key_return_location', 'key_return_location', 'key_return_location_other');
  return lines.length ? lines.join('\n') : null;
}

function buildServiceNotesResponse(booking = {}) {
  return {
    vehicle_parked_location: booking.vehicle_parked_location ?? null,
    vehicle_parked_location_label: resolveChoiceLabel(
      'vehicle_parked_location',
      booking.vehicle_parked_location,
      booking.vehicle_parked_location_other
    ),
    vehicle_parked_location_other: booking.vehicle_parked_location_other ?? null,
    provider_park_location: booking.provider_park_location ?? null,
    provider_park_location_label: resolveChoiceLabel(
      'provider_park_location',
      booking.provider_park_location,
      booking.provider_park_location_other
    ),
    provider_park_location_other: booking.provider_park_location_other ?? null,
    vehicle_key_location: booking.vehicle_key_location ?? null,
    vehicle_key_location_label: resolveChoiceLabel(
      'vehicle_key_location',
      booking.vehicle_key_location,
      booking.vehicle_key_location_other
    ),
    vehicle_key_location_other: booking.vehicle_key_location_other ?? null,
    key_return_location: booking.key_return_location ?? null,
    key_return_location_label: resolveChoiceLabel(
      'key_return_location',
      booking.key_return_location,
      booking.key_return_location_other
    ),
    key_return_location_other: booking.key_return_location_other ?? null,
    parking_instructions: booking.parking_instructions ?? null,
    notes: booking.notes ?? null
  };
}

function assertServiceNotesComplete(booking = {}) {
  for (const spec of FIELD_SPECS) {
    const value = booking[spec.key];
    if (!value || !isAllowedChoice(spec.options, value)) {
      throw new Error(`${spec.key} is required`);
    }
    if (normalizeChoice(value) === 'other') {
      const other = String(booking[spec.otherKey] || '').trim();
      if (!other) throw new Error(`${spec.otherKey} is required`);
    }
  }
}

module.exports = {
  VEHICLE_PARKED_LOCATIONS,
  PROVIDER_PARK_LOCATIONS,
  VEHICLE_KEY_LOCATIONS,
  KEY_RETURN_LOCATIONS,
  parseServiceNotesBody,
  formatServiceNotesSummary,
  buildServiceNotesResponse,
  assertServiceNotesComplete,
  resolveChoiceLabel,
  resolveEvAccountCardOnFile,
  stripLegacyEvAccountCardMarker
};
