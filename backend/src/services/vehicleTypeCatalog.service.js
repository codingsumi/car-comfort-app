'use strict';

const db = require('../models');
const { HttpError } = require('../utils/httpError');

const MAX_VEHICLE_TYPE_LENGTH = 64;

/** Common client labels mapped to canonical catalog names when present in DB. */
const TYPE_ALIASES = {
  truck: 'Pickup Truck',
  pickup: 'Pickup Truck',
  'pick-up': 'Pickup Truck',
  'pick up': 'Pickup Truck',
  'pickup truck': 'Pickup Truck',
};

function normalizeInput(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function collapseSpaces(value) {
  return normalizeInput(value).replace(/\s+/g, ' ');
}

function normalizeTypeKey(value) {
  return collapseSpaces(value).toLowerCase().replace(/[\s-]+/g, '');
}

function findCatalogMatch(rows, input) {
  const collapsed = collapseSpaces(input);
  if (!collapsed) return null;

  const lower = collapsed.toLowerCase();
  const key = normalizeTypeKey(collapsed);

  let match = rows.find((r) => r.name.toLowerCase() === lower);
  if (match) return match;

  match = rows.find((r) => collapseSpaces(r.name).toLowerCase() === lower);
  if (match) return match;

  match = rows.find((r) => normalizeTypeKey(r.name) === key);
  if (match) return match;

  const aliasTarget = TYPE_ALIASES[lower] || TYPE_ALIASES[key];
  if (aliasTarget) {
    match = rows.find((r) => r.name.toLowerCase() === aliasTarget.toLowerCase());
    if (match) return match;
    match = rows.find((r) => normalizeTypeKey(r.name) === normalizeTypeKey(aliasTarget));
    if (match) return match;
  }

  return null;
}

/**
 * Resolve user input to a stored vehicle type name.
 * Uses the active catalog when possible; otherwise keeps a trimmed custom label
 * (e.g. customer "Other" entry) so create/update does not fail.
 * @param {string} input
 * @returns {Promise<string>}
 */
async function resolveActiveVehicleTypeName(input) {
  const normalized = collapseSpaces(input);
  if (!normalized) throw new HttpError(400, 'vehicle_type is required');

  const rows = await db.VehicleType.findAll({
    where: { status: 'active' },
    attributes: ['name'],
    order: [['name', 'ASC']],
  });

  const match = findCatalogMatch(rows, normalized);
  if (match) return match.name;

  if (normalized.toLowerCase() === 'other') {
    const otherRow = rows.find((r) => r.name.toLowerCase() === 'other');
    if (otherRow) return otherRow.name;
  }

  return normalized.slice(0, MAX_VEHICLE_TYPE_LENGTH);
}

async function listActiveVehicleTypeNames() {
  const rows = await db.VehicleType.findAll({
    where: { status: 'active' },
    attributes: ['name'],
    order: [['name', 'ASC']],
  });
  return rows.map((r) => r.name);
}

module.exports = {
  resolveActiveVehicleTypeName,
  listActiveVehicleTypeNames,
  collapseSpaces,
  normalizeTypeKey,
  findCatalogMatch,
};
