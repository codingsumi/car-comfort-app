const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logVehicleActivity } = require('./vehicleActivity.service');

const NON_REMOVED = { [Op.notIn]: ['removed'] };

function normalizeVin(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().toUpperCase();
  return s || null;
}

function isValidVin(v) {
  if (!v) return true;
  const s = String(v).trim().toUpperCase();
  if (s.length !== 17) return false;
  if (/[IOQ]/.test(s)) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s);
}

function validateYear(year) {
  const y = Number.parseInt(String(year), 10);
  const maxY = new Date().getFullYear() + 1;
  if (Number.isNaN(y) || y < 1900 || y > maxY) {
    throw new HttpError(400, 'year is invalid');
  }
  return y;
}

async function assertVinUnique({ vin, excludeVehicleId, transaction } = {}) {
  const normalized = normalizeVin(vin);
  if (!normalized) return;
  const where = {
    vin_number: normalized,
    status: NON_REMOVED
  };
  if (excludeVehicleId) {
    where.id = { [Op.ne]: excludeVehicleId };
  }
  const existing = await db.Vehicle.findOne({ where, attributes: ['id'], transaction });
  if (existing) {
    throw new HttpError(409, 'A vehicle with this VIN is already registered');
  }
}

async function assertPlateUniqueAmongActive({ licensePlateNormalized, excludeVehicleId, transaction } = {}) {
  if (!licensePlateNormalized) return;
  const where = {
    license_plate_normalized: licensePlateNormalized,
    status: NON_REMOVED
  };
  if (excludeVehicleId) {
    where.id = { [Op.ne]: excludeVehicleId };
  }
  const existing = await db.Vehicle.findOne({ where, attributes: ['id'], transaction });
  if (existing) {
    throw new HttpError(409, 'A vehicle with this license plate is already registered');
  }
}

/**
 * Returns duplicate hints (does not throw). Used for auto-flagging and admin UI.
 */
async function findDuplicateHints({ vehicleId, userId, vin, licensePlateNormalized, make, model, year, transaction }) {
  const hints = [];
  const normVin = normalizeVin(vin);
  const normPlate = licensePlateNormalized
    ? String(licensePlateNormalized).trim().toUpperCase()
    : null;

  if (normVin) {
    const vinDup = await db.Vehicle.findAll({
      where: {
        vin_number: normVin,
        status: NON_REMOVED,
        ...(vehicleId ? { id: { [Op.ne]: vehicleId } } : {})
      },
      attributes: ['id', 'user_id'],
      limit: 5,
      transaction
    });
    if (vinDup.length) {
      hints.push({ kind: 'duplicate_vin', other_vehicle_ids: vinDup.map((r) => r.id) });
    }
  }

  if (normPlate) {
    const plateDup = await db.Vehicle.findAll({
      where: {
        license_plate_normalized: normPlate,
        status: NON_REMOVED,
        ...(vehicleId ? { id: { [Op.ne]: vehicleId } } : {})
      },
      attributes: ['id', 'user_id'],
      limit: 5,
      transaction
    });
    if (plateDup.length) {
      hints.push({ kind: 'duplicate_plate', other_vehicle_ids: plateDup.map((r) => r.id) });
    }
  }

  if (userId && normPlate && make && model && year != null) {
    const sameCustomerDup = await db.Vehicle.findAll({
      where: {
        user_id: userId,
        license_plate_normalized: normPlate,
        make,
        model,
        year,
        status: NON_REMOVED,
        ...(vehicleId ? { id: { [Op.ne]: vehicleId } } : {})
      },
      attributes: ['id'],
      limit: 5,
      transaction
    });
    if (sameCustomerDup.length) {
      hints.push({ kind: 'same_customer_duplicate', other_vehicle_ids: sameCustomerDup.map((r) => r.id) });
    }
  }

  return hints;
}

/**
 * Creates open `possible_duplicate` flags + activity logs when hints exist.
 * Call after DB commit for customer flows; may run inside admin transactions.
 * Does not send email — callers invoke notifySupportVehicleFlagged after commit if needed.
 */
async function maybeCreateDuplicateAutoFlags({ vehicleId, userId, actorType, adminOrUserId }, transaction) {
  const vehicle = await db.Vehicle.findByPk(vehicleId, { transaction });
  if (!vehicle) return { hints: [] };

  const hints = await findDuplicateHints({
    vehicleId,
    userId: userId || vehicle.user_id,
    vin: vehicle.vin_number,
    licensePlateNormalized: vehicle.license_plate_normalized,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    transaction
  });

  if (!hints.length) return { hints };

  for (const h of hints) {
    const existingOpen = await db.VehicleFlag.findOne({
      where: {
        vehicle_id: vehicleId,
        flag_type: 'possible_duplicate',
        review_status: { [Op.in]: ['open', 'investigating'] }
      },
      transaction
    });
    if (existingOpen) continue;

    await db.VehicleFlag.create(
      {
        vehicle_id: vehicleId,
        flag_type: 'possible_duplicate',
        reason: `Automated duplicate check: ${h.kind}`,
        review_status: 'open',
        flagged_by: actorType === 'admin' ? adminOrUserId : null
      },
      { transaction }
    );

    await logVehicleActivity(
      {
        vehicleId,
        activityType: 'duplicate_detected',
        actorType: 'system',
        actorId: null,
        metadata: h
      },
      { transaction }
    );
  }

  return { hints };
}

module.exports = {
  normalizeVin,
  isValidVin,
  validateYear,
  assertVinUnique,
  assertPlateUniqueAmongActive,
  findDuplicateHints,
  maybeCreateDuplicateAutoFlags,
  NON_REMOVED
};
