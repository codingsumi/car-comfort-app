function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatServiceArea(row) {
  const data = row.toJSON ? row.toJSON() : row;
  return {
    ...data,
    zip_codes: parseJsonField(data.zip_codes, []),
    boundary_geojson: parseJsonField(data.boundary_geojson, null),
  };
}

async function listServiceAreas(db, { activeOnly = false } = {}) {
  const where = {};
  if (activeOnly) where.is_active = true;

  const rows = await db.ServiceArea.findAll({
    where,
    order: [['name', 'ASC']],
  });

  return rows.map(formatServiceArea);
}

async function getServiceAreaById(db, id) {
  const row = await db.ServiceArea.findByPk(id);
  if (!row) return null;
  return formatServiceArea(row);
}

async function createServiceArea(db, payload) {
  const row = await db.ServiceArea.create({
    name: payload.name,
    country: payload.country || null,
    state: payload.state || null,
    county: payload.county || null,
    city: payload.city || null,
    zip_codes: payload.zip_codes ? JSON.stringify(payload.zip_codes) : null,
    boundary_geojson: payload.boundary_geojson ? JSON.stringify(payload.boundary_geojson) : null,
    is_active: payload.is_active !== false,
  });
  return formatServiceArea(row);
}

async function updateServiceArea(db, id, payload) {
  const row = await db.ServiceArea.findByPk(id);
  if (!row) return null;

  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.country !== undefined) updates.country = payload.country;
  if (payload.state !== undefined) updates.state = payload.state;
  if (payload.county !== undefined) updates.county = payload.county;
  if (payload.city !== undefined) updates.city = payload.city;
  if (payload.zip_codes !== undefined) {
    updates.zip_codes = payload.zip_codes ? JSON.stringify(payload.zip_codes) : null;
  }
  if (payload.boundary_geojson !== undefined) {
    updates.boundary_geojson = payload.boundary_geojson ? JSON.stringify(payload.boundary_geojson) : null;
  }
  if (payload.is_active !== undefined) updates.is_active = payload.is_active;

  await row.update(updates);
  return formatServiceArea(row);
}

async function deleteServiceArea(db, id) {
  const row = await db.ServiceArea.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

module.exports = {
  listServiceAreas,
  getServiceAreaById,
  createServiceArea,
  updateServiceArea,
  deleteServiceArea,
};
