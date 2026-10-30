const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { clearBookingChargesCache } = require('../bookingCharges.service');
const {
  BOOKING_CHARGE_CODES,
  NON_DELETABLE_BOOKING_CHARGE_CODES,
} = require('../../constants/bookingChargeCodes');
const {
  BOOKING_CHARGE_SERVICE_APPLICABILITY,
  normalizeServiceApplicability,
} = require('../../constants/bookingChargeApplicability');

function formatBookingCharge(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    code: plain.code,
    label: plain.label,
    amount: plain.amount,
    is_active: Boolean(plain.is_active),
    sort_order: plain.sort_order,
    service_applicability: normalizeServiceApplicability(plain.service_applicability),
    created_at: plain.created_at ?? plain.createdAt ?? null,
    updated_at: plain.updated_at ?? plain.updatedAt ?? null,
  };
}

function parseServiceApplicability(value) {
  if (value === undefined || value === null || value === '') {
    return BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL;
  }
  const normalized = normalizeServiceApplicability(value);
  const allowed = new Set(Object.values(BOOKING_CHARGE_SERVICE_APPLICABILITY));
  if (!allowed.has(normalized)) {
    throw new HttpError(400, 'service_applicability must be all, car_wash, or ev_charging');
  }
  return normalized;
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(400, 'amount is required');
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpError(400, 'amount must be a non-negative number');
  }
  return Math.round(n * 100) / 100;
}

function parseCode(value) {
  const code = String(value || '').trim().toLowerCase();
  if (!code) throw new HttpError(400, 'code is required');
  if (!/^[a-z0-9_]+$/.test(code)) {
    throw new HttpError(400, 'code may only contain lowercase letters, numbers, and underscores');
  }
  if (code.length > 64) throw new HttpError(400, 'code must be 64 characters or fewer');
  return code;
}

function parseLabel(value) {
  const label = String(value || '').trim();
  if (!label) throw new HttpError(400, 'label is required');
  if (label.length > 160) throw new HttpError(400, 'label must be 160 characters or fewer');
  return label;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

async function listAdminBookingCharges() {
  const rows = await db.BookingCharge.findAll({
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map(formatBookingCharge);
}

async function createAdminBookingCharge(body) {
  const code = parseCode(body.code);
  const label = parseLabel(body.label);
  const amount = parseAmount(body.amount);
  const existing = await db.BookingCharge.findOne({ where: { code } });
  if (existing) throw new HttpError(409, 'Booking charge code already exists');

  const maxSortOrder = await db.BookingCharge.max('sort_order');
  const sortOrder =
    body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== ''
      ? Number.parseInt(String(body.sort_order), 10)
      : Number(maxSortOrder || 0) + 1;

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new HttpError(400, 'sort_order must be a non-negative integer');
  }

  const row = await db.BookingCharge.create({
    code,
    label,
    amount,
    is_active: Object.prototype.hasOwnProperty.call(body, 'is_active')
      ? parseBoolean(body.is_active)
      : true,
    sort_order: sortOrder,
    service_applicability: parseServiceApplicability(body.service_applicability),
  });
  clearBookingChargesCache();
  return formatBookingCharge(row);
}

async function updateAdminBookingCharge(id, body) {
  const rowId = Number.parseInt(String(id), 10);
  if (!rowId || rowId < 1) throw new HttpError(400, 'Invalid booking charge id');

  const row = await db.BookingCharge.findByPk(rowId);
  if (!row) throw new HttpError(404, 'Booking charge not found');

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'label')) {
    updates.label = parseLabel(body.label);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'amount')) {
    updates.amount = parseAmount(body.amount);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
    updates.is_active = parseBoolean(body.is_active);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'service_applicability')) {
    if (row.code === BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE) {
      throw new HttpError(
        400,
        'CarComfort service fee always applies to car wash custom packages only'
      );
    }
    updates.service_applicability = parseServiceApplicability(body.service_applicability);
  }

  if (Object.keys(updates).length === 0) {
    return formatBookingCharge(row);
  }

  await row.update(updates);
  clearBookingChargesCache();
  return formatBookingCharge(row);
}

async function deleteAdminBookingCharge(id) {
  const rowId = Number.parseInt(String(id), 10);
  if (!rowId || rowId < 1) throw new HttpError(400, 'Invalid booking charge id');

  const row = await db.BookingCharge.findByPk(rowId);
  if (!row) throw new HttpError(404, 'Booking charge not found');

  if (NON_DELETABLE_BOOKING_CHARGE_CODES.has(row.code)) {
    throw new HttpError(
      409,
      'This booking charge is required by the platform and cannot be deleted. Deactivate it instead.'
    );
  }

  await row.destroy();
  clearBookingChargesCache();
  return { id: rowId };
}

module.exports = {
  listAdminBookingCharges,
  createAdminBookingCharge,
  updateAdminBookingCharge,
  deleteAdminBookingCharge,
};
