const { Op } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');

function parseCharges(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, 'charges is required');
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpError(400, 'charges must be a non-negative number');
  }
  return Math.round(n * 100) / 100;
}

function formatVehicleType(row, vehicleCount = 0) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    name: plain.name,
    status: plain.status,
    charges: plain.charges,
    vehicle_count: vehicleCount,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

/**
 * Build a lookup map of { lowerCasedName -> count } for the given type names
 * in a SINGLE query using GROUP BY instead of one query per row (N+1 fix).
 */
async function buildVehicleCountMap(names) {
  if (!names || names.length === 0) return {};

  const lowerNames = names.map((n) => n.toLowerCase());

  const rows = await db.Vehicle.findAll({
    attributes: [
      [db.sequelize.fn('LOWER', db.sequelize.col('vehicle_type')), 'type_lower'],
      [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'cnt'],
    ],
    where: db.sequelize.where(
      db.sequelize.fn('LOWER', db.sequelize.col('vehicle_type')),
      { [require('sequelize').Op.in]: lowerNames }
    ),
    group: [db.sequelize.fn('LOWER', db.sequelize.col('vehicle_type'))],
    raw: true,
  });

  const map = {};
  for (const row of rows) {
    map[row.type_lower] = Number(row.cnt);
  }
  return map;
}

/** Single-name count — used for create/update/delete guards where only one type is involved. */
async function countVehiclesForTypeName(name) {
  if (!name) return 0;
  const map = await buildVehicleCountMap([name]);
  return map[name.toLowerCase()] ?? 0;
}

async function listAdminVehicleTypes({
  page = 1,
  limit = 20,
  status,
  search,
  sort = 'name',
  order = 'asc',
}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.name = { [Op.like]: `%${String(search).trim()}%` };
  }

  const validSortFields = ['name', 'status', 'charges', 'created_at', 'updated_at'];
  const sortField = validSortFields.includes(sort) ? sort : 'name';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  const result = await db.VehicleType.findAndCountAll({
    where,
    order: [[sortField, sortOrder]],
    limit: limitNum,
    offset,
  });

  // Single GROUP BY query for all vehicle counts — O(1) queries instead of O(N)
  const typeNames = result.rows.map((r) => r.name);
  const countMap = await buildVehicleCountMap(typeNames);

  const rows = result.rows.map((row) =>
    formatVehicleType(row, countMap[row.name.toLowerCase()] ?? 0)
  );

  return {
    rows,
    count: result.count,
    totalPages: Math.ceil(result.count / limitNum),
    currentPage: pageNum,
  };
}

async function listAdminVehicleTypesAll({ status } = {}) {
  const where = {};
  if (status) where.status = status;

  const rows = await db.VehicleType.findAll({
    where,
    order: [['name', 'ASC']],
  });

  // Single GROUP BY query for all vehicle counts — O(1) queries instead of O(N)
  const typeNames = rows.map((r) => r.name);
  const countMap = await buildVehicleCountMap(typeNames);
  return rows.map((row) => formatVehicleType(row, countMap[row.name.toLowerCase()] ?? 0));
}

async function createAdminVehicleType({ name, status, charges }) {
  const typeName = String(name || '').trim();
  if (!typeName) throw new HttpError(400, 'Name is required');
  const chargesValue = parseCharges(charges, { required: true });

  try {
    const created = await db.VehicleType.create({
      name: typeName,
      status: status || 'active',
      charges: chargesValue,
    });
    return formatVehicleType(created, 0);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'A vehicle type with this name already exists');
    }
    throw err;
  }
}

async function updateAdminVehicleType(id, body) {
  const rowId = Number.parseInt(String(id), 10);
  if (!rowId || rowId < 1) throw new HttpError(400, 'Invalid vehicle type id');

  const row = await db.VehicleType.findByPk(rowId);
  if (!row) throw new HttpError(404, 'Vehicle type not found');

  const previousName = row.name;
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const typeName = String(body.name || '').trim();
    if (!typeName) throw new HttpError(400, 'Name cannot be empty');
    updates.name = typeName;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    updates.status = body.status;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'charges')) {
    updates.charges = parseCharges(body.charges, { required: true });
  }

  if (Object.keys(updates).length === 0) {
    const vehicleCount = await countVehiclesForTypeName(row.name);
    return formatVehicleType(row, vehicleCount);
  }

  if (updates.status === 'inactive') {
    const vehicleCount = await countVehiclesForTypeName(row.name);
    if (vehicleCount > 0) {
      throw new HttpError(
        409,
        'Cannot deactivate this vehicle type while vehicles are still using it. Reassign those vehicles first.'
      );
    }
  }

  try {
    await row.update(updates);

    if (updates.name && updates.name !== previousName) {
      await db.Vehicle.update(
        { vehicle_type: updates.name },
        {
          where: db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('vehicle_type')),
            previousName.toLowerCase()
          ),
        }
      );
    }

    const vehicleCount = await countVehiclesForTypeName(row.name);
    return formatVehicleType(row, vehicleCount);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'A vehicle type with this name already exists');
    }
    throw err;
  }
}

async function deleteAdminVehicleType(id) {
  const rowId = Number.parseInt(String(id), 10);
  if (!rowId || rowId < 1) throw new HttpError(400, 'Invalid vehicle type id');

  const row = await db.VehicleType.findByPk(rowId);
  if (!row) throw new HttpError(404, 'Vehicle type not found');

  const vehicleCount = await countVehiclesForTypeName(row.name);
  if (vehicleCount > 0) {
    throw new HttpError(
      409,
      'Cannot delete this vehicle type while vehicles are still using it. Deactivate it or reassign vehicles first.'
    );
  }

  row.status = 'inactive';
  await row.save();
  return { id: row.id };
}

module.exports = {
  listAdminVehicleTypes,
  listAdminVehicleTypesAll,
  createAdminVehicleType,
  updateAdminVehicleType,
  deleteAdminVehicleType,
};
