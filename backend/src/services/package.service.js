const db = require('../models');
const { HttpError } = require('../utils/httpError');

const SERVICE_TYPES = new Set(['car_wash', 'ev_charging', 'combo']);

function normalizeServiceType(value) {
  if (value === undefined || value === null) return null;
  const t = String(value).trim();
  return t ? t : null;
}

async function listServices() {
  const services = await db.Service.findAll({
    attributes: ['id', 'name', 'icon'],
    order: [['id', 'ASC']]
  });
  return services.map((s) => s.get({ plain: true }));
}

async function listPackagesByService({ serviceType, query }) {
  const service = normalizeServiceType(serviceType);
  if (!service || !SERVICE_TYPES.has(service)) throw new HttpError(400, 'Invalid service type');

  const where = { '$service.name$': service, is_active: true };

  const rows = await db.Package.findAll({
    where,
    include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
    order: [['id', 'ASC']]
  });

  return rows.map((r) => r.get({ plain: true }));
}

async function getPackageDetails(packageId) {
  const id = Number.parseInt(String(packageId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid package id');

  const pkg = await db.Package.findByPk(id, {
    include: [
      { model: db.Service, as: 'service', attributes: ['id', 'name'] },
      { model: db.PackageFeature, as: 'features', attributes: ['id', 'feature_name'] },
      { model: db.AddOn, as: 'addons', attributes: ['id', 'name', 'price'], through: { attributes: [] } }
    ]
  });
  if (!pkg) throw new HttpError(404, 'Package not found');
  return pkg.get({ plain: true });
}

module.exports = {
  listServices,
  listPackagesByService,
  getPackageDetails
};

