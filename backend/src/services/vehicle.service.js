const fs = require('fs');
const path = require('path');

const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { bufferToWebp, publicPathToDiskPath, saveWebpFile } = require('../utils/fileUpload');

const {
  normalizeVin,
  isValidVin,
  validateYear,
  assertVinUnique,
  assertPlateUniqueAmongActive,
  maybeCreateDuplicateAutoFlags
} = require('./vehicleValidation.service');
const { logVehicleActivity } = require('./vehicleActivity.service');
const { notifySupportVehicleFlagged, notifyAdminsSuspiciousVehicle } = require('./vehicleNotify.service');
const {
  normalizeFuelType,
  isElectricFuelType,
  fuelTypeValidationMessage,
} = require('../constants/vehicleFuelTypes');
const { resolveActiveVehicleTypeName } = require('./vehicleTypeCatalog.service');

function parseFuelType(raw, { required = false, defaultValue = 'GAS' } = {}) {
  const fuel_type = normalizeFuelType(raw, { defaultValue: required ? null : defaultValue });
  if (!fuel_type) {
    throw new HttpError(400, fuelTypeValidationMessage());
  }
  return fuel_type;
}

function activeVehicleWhere(userId) {
  return { user_id: userId, status: { [Op.ne]: 'removed' } };
}

const TERMINAL_BOOKING_STATUSES = ['completed', 'cancelled', 'failed', 'refunded'];

async function assertNoActiveBookingsForVehicle(vehicleId, transaction) {
  const n = await db.Booking.count({
    where: {
      vehicle_id: vehicleId,
      status: { [Op.notIn]: TERMINAL_BOOKING_STATUSES }
    },
    transaction
  });
  if (n > 0) {
    throw new HttpError(409, 'Cannot delete vehicle with active bookings');
  }
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return String(value).trim() || null;
  const t = value.trim();
  return t ? t : null;
}

function sanitizeFolderName(name) {
  return String(name || 'vehicle')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function safeUnlink(diskPath) {
  if (!diskPath) return;
  try {
    fs.unlinkSync(diskPath);
  } catch {
    // file may already be removed
  }
}

function safeRemoveDir(dirPath) {
  if (!dirPath) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function getVehicleImagesDirByPlate(licensePlate) {
  const root = process.env.UPLOAD_DIR || 'uploads';
  const plateFolder = sanitizeFolderName(licensePlate);
  const dir = path.join(root, 'vehicles', plateFolder);

  // Safety guard: only allow deleting within uploads/vehicles
  const safeBase = path.join(root, 'vehicles') + path.sep;
  const resolved = path.resolve(dir) + path.sep;
  const resolvedBase = path.resolve(safeBase);
  if (!resolved.startsWith(resolvedBase)) return null;
  return dir;
}

function getImageDiskPaths(vehicle) {
  const images = vehicle.images || [];
  return images
    .map((img) => {
      const p = img.get ? img.get('image_path') : img.image_path;
      return publicPathToDiskPath(p);
    })
    .filter(Boolean);
}

/**
 * @param {import('express').Request} req
 * @param {import('multer').File[]} files
 */
async function createVehicleWithImages(req, { userId, body, files }) {
  const vehicle_type = await resolveActiveVehicleTypeName(body.vehicle_type);
  const make = normalizeString(body.make);
  const model = normalizeString(body.model);
  const color = normalizeString(body.color);
  const license_plate = normalizeString(body.license_plate);
  const nickname = normalizeString(body.nickname);
  const year = validateYear(body.year);
  const fuel_type = parseFuelType(body.fuel_type, { defaultValue: 'GAS' });
  const _rawBattery = body.battery_capacity_kwh;
  const battery_capacity_kwh =
    (_rawBattery === null || _rawBattery === undefined || String(_rawBattery).trim() === '')
      ? null
      : parseFloat(_rawBattery);
  const vinNorm = normalizeVin(body.vin_number);
  if (body.vin_number != null && String(body.vin_number).trim() && !isValidVin(body.vin_number)) {
    throw new HttpError(400, 'Invalid VIN');
  }
  const notes =
    body.notes === undefined || body.notes === null || body.notes === ''
      ? null
      : String(body.notes).slice(0, 5000);

  const { sequelize, Vehicle, VehicleImage } = db;
  const t = await sequelize.transaction();
  const savedDiskPaths = [];

  try {
    await assertVinUnique({ vin: vinNorm, transaction: t });
    const plateNorm = license_plate ? license_plate.trim().toUpperCase() : '';
    await assertPlateUniqueAmongActive({ licensePlateNormalized: plateNorm, transaction: t });

    const vehicle = await Vehicle.create(
      {
        user_id: userId,
        vehicle_type,
        make,
        model,
        year,
        color,
        license_plate,
        vin_number: vinNorm,
        nickname: nickname || null,
        notes,
        fuel_type,
        battery_capacity_kwh: isElectricFuelType(fuel_type) ? battery_capacity_kwh : null,
        status: 'active'
      },
      { transaction: t }
    );

    const plateFolder = sanitizeFolderName(vehicle.license_plate);
    const uploadDir = `vehicles/${plateFolder}`;

    for (const file of files) {
      const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
      const saved = await saveWebpFile({
        buffer: webp,
        uploadDir,
        req,
        fileBaseName: file.originalname || 'vehicle'
      });
      savedDiskPaths.push(saved.diskPath);
      await VehicleImage.create(
        { vehicle_id: vehicle.id, image_path: saved.publicPath, image_type: 'other' },
        { transaction: t }
      );
    }

    await t.commit();

    const full = await Vehicle.findByPk(vehicle.id, { include: [{ model: VehicleImage, as: 'images' }] });

    // Fire post-commit side-effects without blocking the API response.
    const _vid = vehicle.id;
    const _uid = userId;
    Promise.resolve().then(async () => {
      await logVehicleActivity({ vehicleId: _vid, activityType: 'vehicle_added', actorType: 'customer', actorId: _uid, metadata: {} }).catch(() => {});
      const { hints } = await maybeCreateDuplicateAutoFlags({ vehicleId: _vid, userId: _uid, actorType: 'customer', adminOrUserId: null }, null).catch(() => ({ hints: [] }));
      if (hints?.length) {
        notifySupportVehicleFlagged({ vehicleId: _vid, subject: 'Suspicious vehicle duplicate detected', body: `Vehicle #${_vid} was auto-flagged: ${hints.map((h) => h.kind).join(', ')}.` }).catch(() => {});
        notifyAdminsSuspiciousVehicle({ vehicleId: _vid, summary: `Possible duplicate vehicle #${_vid}. Review in admin Vehicles.` }).catch(() => {});
      }
    });

    return full;
  } catch (err) {
    await t.rollback();
    for (const p of savedDiskPaths) safeUnlink(p);
    throw err;
  }
}

async function listVehiclesByUserId(userId) {
  return db.Vehicle.findAll({
    where: activeVehicleWhere(userId),
    include: [{ model: db.VehicleImage, as: 'images' }],
    order: [['created_at', 'DESC']]
  });
}

async function getVehicleForUser({ userId, vehicleId }) {
  const row = await db.Vehicle.findOne({
    where: { id: vehicleId, user_id: userId, status: { [Op.ne]: 'removed' } },
    include: [{ model: db.VehicleImage, as: 'images' }]
  });
  if (!row) throw new HttpError(404, 'Vehicle not found');
  return row;
}

async function updateVehicleForUser({ userId, vehicleId, body }) {
  const vehicle = await db.Vehicle.findOne({
    where: { id: vehicleId, user_id: userId, status: { [Op.ne]: 'removed' } }
  });
  if (!vehicle) throw new HttpError(404, 'Vehicle not found');

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, 'vehicle_type')) {
    updates.vehicle_type = await resolveActiveVehicleTypeName(body.vehicle_type);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'make')) {
    const v = normalizeString(body.make);
    if (!v) throw new HttpError(400, 'make cannot be empty');
    updates.make = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'model')) {
    const v = normalizeString(body.model);
    if (!v) throw new HttpError(400, 'model cannot be empty');
    updates.model = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'color')) {
    const v = normalizeString(body.color);
    if (!v) throw new HttpError(400, 'color cannot be empty');
    updates.color = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'license_plate')) {
    const v = normalizeString(body.license_plate);
    if (!v) throw new HttpError(400, 'license_plate cannot be empty');
    await assertPlateUniqueAmongActive({
      licensePlateNormalized: v.trim().toUpperCase(),
      excludeVehicleId: vehicleId
    });
    updates.license_plate = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'vin_number')) {
    const raw = body.vin_number;
    if (raw === null || raw === '') {
      updates.vin_number = null;
    } else {
      if (!isValidVin(raw)) throw new HttpError(400, 'Invalid VIN');
      const vinNorm = normalizeVin(raw);
      await assertVinUnique({ vin: vinNorm, excludeVehicleId: vehicleId });
      updates.vin_number = vinNorm;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    updates.notes = body.notes === null || body.notes === '' ? null : String(body.notes).slice(0, 5000);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'nickname')) {
    const v = body.nickname === '' || body.nickname === null ? null : normalizeString(body.nickname);
    updates.nickname = v;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'year')) {
    updates.year = validateYear(body.year);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'fuel_type')) {
    updates.fuel_type = parseFuelType(body.fuel_type, { required: true });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'battery_capacity_kwh')) {
    const v = body.battery_capacity_kwh;
    if (v === null || v === '') {
      updates.battery_capacity_kwh = null;
    } else {
      const num = parseFloat(v);
      if (Number.isNaN(num) || num < 0) throw new HttpError(400, 'battery_capacity_kwh must be a non-negative number');
      updates.battery_capacity_kwh = num;
    }
  }

  const effectiveFuelType = updates.fuel_type || vehicle.fuel_type;
  // battery_capacity_kwh is optional even for ELECTRIC vehicles — store null when not provided.
  if (!isElectricFuelType(effectiveFuelType) && !Object.prototype.hasOwnProperty.call(updates, 'battery_capacity_kwh')) {
    updates.battery_capacity_kwh = null;
  }

  if (!Object.keys(updates).length) throw new HttpError(400, 'No fields to update');
  await vehicle.update(updates);

  const _updFields = Object.keys(updates);
  const _vu = userId;
  const _vv = vehicleId;
  Promise.resolve().then(async () => {
    await logVehicleActivity({ vehicleId: _vv, activityType: 'vehicle_updated', actorType: 'customer', actorId: _vu, metadata: { fields: _updFields } }).catch(() => {});
    const { hints } = await maybeCreateDuplicateAutoFlags({ vehicleId: _vv, userId: _vu, actorType: 'customer', adminOrUserId: null }, null).catch(() => ({ hints: [] }));
    if (hints?.length) {
      notifySupportVehicleFlagged({ vehicleId: _vv, subject: 'Suspicious vehicle duplicate detected', body: `Vehicle #${_vv} was auto-flagged after update: ${hints.map((h) => h.kind).join(', ')}.` }).catch(() => {});
    }
  });

  return getVehicleForUser({ userId, vehicleId });
}

/**
 * If `files` provided, replaces all images for the vehicle (optional).
 * Also updates any provided vehicle fields (optional).
 *
 * Uses a DB transaction. Old image files are removed after commit.
 * Newly created files are removed on rollback.
 *
 * @param {import('express').Request} req
 * @param {import('multer').File[]} files
 */
async function updateVehicleWithOptionalImages(req, { userId, vehicleId, body, files }) {
  const { sequelize, Vehicle, VehicleImage } = db;
  const t = await sequelize.transaction();

  const newDiskPaths = [];
  let oldDiskPaths = [];

  try {
    const vehicle = await Vehicle.findOne({
      where: { id: vehicleId, user_id: userId, status: { [Op.ne]: 'removed' } },
      include: [{ model: VehicleImage, as: 'images' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    // Apply updates if present (same rules as updateVehicleForUser).
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'vehicle_type')) {
      updates.vehicle_type = await resolveActiveVehicleTypeName(body.vehicle_type);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'make')) {
      const v = normalizeString(body.make);
      if (!v) throw new HttpError(400, 'make cannot be empty');
      updates.make = v;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'model')) {
      const v = normalizeString(body.model);
      if (!v) throw new HttpError(400, 'model cannot be empty');
      updates.model = v;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'color')) {
      const v = normalizeString(body.color);
      if (!v) throw new HttpError(400, 'color cannot be empty');
      updates.color = v;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'license_plate')) {
      const v = normalizeString(body.license_plate);
      if (!v) throw new HttpError(400, 'license_plate cannot be empty');
      await assertPlateUniqueAmongActive({
        licensePlateNormalized: v.trim().toUpperCase(),
        excludeVehicleId: vehicleId,
        transaction: t
      });
      updates.license_plate = v;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'vin_number')) {
      const raw = body.vin_number;
      if (raw === null || raw === '') {
        updates.vin_number = null;
      } else {
        if (!isValidVin(raw)) throw new HttpError(400, 'Invalid VIN');
        const vinNorm = normalizeVin(raw);
        await assertVinUnique({ vin: vinNorm, excludeVehicleId: vehicleId, transaction: t });
        updates.vin_number = vinNorm;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      updates.notes = body.notes === null || body.notes === '' ? null : String(body.notes).slice(0, 5000);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'nickname')) {
      const v = body.nickname === '' || body.nickname === null ? null : normalizeString(body.nickname);
      updates.nickname = v;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'year')) {
      updates.year = validateYear(body.year);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'fuel_type')) {
      updates.fuel_type = parseFuelType(body.fuel_type, { required: true });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'battery_capacity_kwh')) {
      const v = body.battery_capacity_kwh;
      if (v === null || v === '') {
        updates.battery_capacity_kwh = null;
      } else {
        const num = parseFloat(v);
        if (Number.isNaN(num) || num < 0) throw new HttpError(400, 'battery_capacity_kwh must be a non-negative number');
        updates.battery_capacity_kwh = num;
      }
    }

    const effectiveFuelType = updates.fuel_type || vehicle.fuel_type;
    // battery_capacity_kwh is optional even for ELECTRIC vehicles — store null when not provided.
    if (!isElectricFuelType(effectiveFuelType) && !Object.prototype.hasOwnProperty.call(updates, 'battery_capacity_kwh')) {
      updates.battery_capacity_kwh = null;
    }

    if (Object.keys(updates).length) {
      await vehicle.update(updates, { transaction: t });
    }

    // Replace images if provided.
    if (Array.isArray(files) && files.length) {
      const plateFolder = sanitizeFolderName(updates.license_plate || vehicle.license_plate);
      const uploadDir = `vehicles/${plateFolder}`;

      oldDiskPaths = getImageDiskPaths(vehicle);

      await VehicleImage.destroy({
        where: { vehicle_id: vehicle.id },
        transaction: t
      });

      for (const file of files) {
        const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
        const saved = await saveWebpFile({
          buffer: webp,
          uploadDir,
          req,
          fileBaseName: file.originalname || 'vehicle'
        });
        newDiskPaths.push(saved.diskPath);
        await VehicleImage.create(
          { vehicle_id: vehicle.id, image_path: saved.publicPath, image_type: 'other' },
          { transaction: t }
        );
      }
    }

    await t.commit();

    // After commit, remove the old files (best-effort).
    for (const p of oldDiskPaths) safeUnlink(p);

    const _wVid = vehicleId;
    const _wUid = userId;
    const _wFields = Object.keys(updates);
    const _wImgs = Boolean(files?.length);
    Promise.resolve().then(async () => {
      await logVehicleActivity({ vehicleId: _wVid, activityType: 'vehicle_updated', actorType: 'customer', actorId: _wUid, metadata: { fields: _wFields, images_replaced: _wImgs } }).catch(() => {});
      const { hints } = await maybeCreateDuplicateAutoFlags({ vehicleId: _wVid, userId: _wUid, actorType: 'customer', adminOrUserId: null }, null).catch(() => ({ hints: [] }));
      if (hints?.length) {
        notifySupportVehicleFlagged({ vehicleId: _wVid, subject: 'Suspicious vehicle duplicate detected', body: `Vehicle #${_wVid} was auto-flagged after update: ${hints.map((h) => h.kind).join(', ')}.` }).catch(() => {});
      }
    });

    return Vehicle.findByPk(vehicle.id, { include: [{ model: VehicleImage, as: 'images' }] });
  } catch (err) {
    await t.rollback();
    for (const p of newDiskPaths) safeUnlink(p);
    throw err;
  }
}

async function deleteVehicleForUser({ userId, vehicleId }) {
  const { sequelize, Vehicle } = db;
  const t = await sequelize.transaction();

  try {
    const vehicle = await Vehicle.findOne({
      where: { id: vehicleId, user_id: userId, status: { [Op.ne]: 'removed' } },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!vehicle) {
      throw new HttpError(404, 'Vehicle not found');
    }

    await assertNoActiveBookingsForVehicle(vehicle.id, t);

    await vehicle.update(
      {
        status: 'removed',
        removed_at: new Date(),
        removal_reason: 'Customer removed vehicle'
      },
      { transaction: t }
    );

    await t.commit();

    // Fire activity log after commit so it never blocks the response.
    logVehicleActivity({
      vehicleId,
      activityType: 'vehicle_removed',
      actorType: 'customer',
      actorId: userId,
      metadata: { source: 'customer_app' }
    }).catch(() => {});
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function setDefaultVehicleForUser({ userId, vehicleId }) {
  const { sequelize, Vehicle } = db;
  const t = await sequelize.transaction();

  try {
    const vehicle = await Vehicle.findOne({
      where: { id: vehicleId, user_id: userId, status: { [Op.ne]: 'removed' } },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    await Vehicle.update(
      { is_default: false },
      {
        where: { user_id: userId, is_default: true, status: { [Op.ne]: 'removed' } },
        transaction: t
      }
    );

    await vehicle.update({ is_default: true }, { transaction: t });
    await t.commit();
    return getVehicleForUser({ userId, vehicleId });
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = {
  createVehicleWithImages,
  listVehiclesByUserId,
  getVehicleForUser,
  updateVehicleForUser,
  updateVehicleWithOptionalImages,
  deleteVehicleForUser,
  setDefaultVehicleForUser
};
