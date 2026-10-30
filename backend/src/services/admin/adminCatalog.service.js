const { Op } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const {
  SERVICE_TYPES,
  isValidServiceType,
  serviceTypeLabel,
} = require('../../constants/serviceTypes');
const {
  normalizeCompensationType,
  toAmount,
} = require('../../utils/providerCompensation');

const DEFAULT_DURATION_MINUTES = 30;

async function resolveServiceId(serviceType) {
  const type = String(serviceType || '').trim();
  if (!isValidServiceType(type)) {
    throw new HttpError(400, 'Invalid service type');
  }
  const service = await db.Service.findOne({ where: { name: type } });
  if (!service) throw new HttpError(404, 'Service not found');
  return service.id;
}

function formatAdminService(row, counts = {}) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const serviceType = plain.name;
  return {
    id: plain.id,
    service_type: serviceType,
    name: serviceTypeLabel(serviceType),
    icon: plain.icon,
    package_count: counts.package_count ?? 0,
    active_package_count: counts.active_package_count ?? 0,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

function formatAdminPackage(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const service = plain.service || {};
  const serviceType = service.name || null;
  return {
    id: plain.id,
    service_id: plain.service_id,
    service_type: serviceType,
    service_type_label: serviceType ? serviceTypeLabel(serviceType) : null,
    package_name: plain.name,
    price: plain.base_price,
    base_price: plain.base_price,
    provider_compensation_type: normalizeCompensationType(plain.provider_compensation_type),
    on_demand_provider_compensation_type:
      plain.on_demand_provider_compensation_type == null
        ? null
        : normalizeCompensationType(plain.on_demand_provider_compensation_type),
    provider_compensation_value: toAmount(plain.provider_compensation_value),
    on_demand_provider_compensation_value:
      plain.on_demand_provider_compensation_value == null
        ? null
        : toAmount(plain.on_demand_provider_compensation_value),
    duration_minutes: plain.duration_minutes,
    description: plain.description,
    is_active: Boolean(plain.is_active),
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

async function listAdminServices() {
  const services = await db.Service.findAll({
    order: [['id', 'ASC']],
  });

  const packageCounts = await db.Package.findAll({
    attributes: [
      'service_id',
      [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'package_count'],
      [
        db.sequelize.fn(
          'SUM',
          db.sequelize.literal('CASE WHEN is_active = 1 THEN 1 ELSE 0 END')
        ),
        'active_package_count',
      ],
    ],
    group: ['service_id'],
    raw: true,
  });

  const countByServiceId = Object.fromEntries(
    packageCounts.map((row) => [
      Number(row.service_id),
      {
        package_count: Number(row.package_count) || 0,
        active_package_count: Number(row.active_package_count) || 0,
      },
    ])
  );

  return services.map((service) =>
    formatAdminService(service, countByServiceId[service.id] || {})
  );
}

async function patchAdminService(serviceId, { icon }) {
  const id = Number.parseInt(String(serviceId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid service id');

  const service = await db.Service.findByPk(id);
  if (!service) throw new HttpError(404, 'Service not found');

  if (icon !== undefined) {
    const nextIcon = icon === null || icon === '' ? null : String(icon).trim();
    await service.update({ icon: nextIcon || null });
  }

  const counts = await db.Package.findOne({
    attributes: [
      [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'package_count'],
      [
        db.sequelize.fn(
          'SUM',
          db.sequelize.literal('CASE WHEN is_active = 1 THEN 1 ELSE 0 END')
        ),
        'active_package_count',
      ],
    ],
    where: { service_id: id },
    raw: true,
  });

  return formatAdminService(service, {
    package_count: Number(counts?.package_count) || 0,
    active_package_count: Number(counts?.active_package_count) || 0,
  });
}

async function listAdminPackages({
  page = 1,
  limit = 20,
  service_type,
  is_active,
  search,
  sort = 'created_at',
  order = 'desc',
}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  const include = [
    { model: db.Service, as: 'service', attributes: ['id', 'name'], required: true },
  ];

  if (service_type) {
    if (!isValidServiceType(service_type)) throw new HttpError(400, 'Invalid service type');
    include[0].where = { name: service_type };
  }

  if (is_active !== undefined && is_active !== '') {
    where.is_active = is_active === 'true' || is_active === true;
  }

  if (search) {
    where.name = { [Op.like]: `%${String(search).trim()}%` };
  }

  const validSortFields = ['created_at', 'package_name', 'price', 'is_active', 'service_type'];
  const sortField = validSortFields.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  let orderClause;
  if (sortField === 'package_name') {
    orderClause = [['name', sortOrder]];
  } else if (sortField === 'price') {
    orderClause = [['base_price', sortOrder]];
  } else if (sortField === 'service_type') {
    orderClause = [[{ model: db.Service, as: 'service' }, 'name', sortOrder]];
  } else {
    orderClause = [[sortField, sortOrder]];
  }

  const result = await db.Package.findAndCountAll({
    where,
    include,
    order: orderClause,
    limit: limitNum,
    offset,
    distinct: true,
  });

  return {
    rows: result.rows.map(formatAdminPackage),
    count: result.count,
    totalPages: Math.ceil(result.count / limitNum),
    currentPage: pageNum,
  };
}

async function createAdminPackage(body) {
  const packageName = String(body.package_name || body.name || '').trim();
  if (!packageName) throw new HttpError(400, 'Package name is required');

  const serviceType = body.service_type;
  if (!isValidServiceType(serviceType)) throw new HttpError(400, 'Valid service type is required');

  const price = Number(body.price ?? body.base_price);
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Price must be a non-negative number');

  const serviceId = await resolveServiceId(serviceType);
  const providerCompensationType = normalizeCompensationType(
    body.provider_compensation_type
  );
  const providerCompensationValue =
    body.provider_compensation_value !== undefined
      ? toAmount(body.provider_compensation_value)
      : providerCompensationType === 'percentage'
        ? 100
        : 0;
  const onDemandProviderCompensationValue =
    body.on_demand_provider_compensation_value === undefined ||
    body.on_demand_provider_compensation_value === null ||
    body.on_demand_provider_compensation_value === ''
      ? null
      : toAmount(body.on_demand_provider_compensation_value);
  const onDemandProviderCompensationType =
    body.on_demand_provider_compensation_type === undefined ||
    body.on_demand_provider_compensation_type === null ||
    body.on_demand_provider_compensation_type === ''
      ? null
      : normalizeCompensationType(body.on_demand_provider_compensation_type);
  if (providerCompensationType === 'fixed' && providerCompensationValue < 0) {
    throw new HttpError(400, 'Fixed provider compensation cannot be negative');
  }
  if (
    providerCompensationType === 'percentage' &&
    (providerCompensationValue < 0 || providerCompensationValue > 100)
  ) {
    throw new HttpError(400, 'Percentage provider compensation must be between 0 and 100');
  }
  if (
    onDemandProviderCompensationValue != null &&
    (onDemandProviderCompensationType || providerCompensationType) === 'percentage' &&
    (onDemandProviderCompensationValue < 0 || onDemandProviderCompensationValue > 100)
  ) {
    throw new HttpError(400, 'On-demand percentage compensation must be between 0 and 100');
  }
  const durationMinutes = Number.parseInt(String(body.duration_minutes ?? DEFAULT_DURATION_MINUTES), 10);
  if (!durationMinutes || durationMinutes < 1) {
    throw new HttpError(400, 'Duration must be at least 1 minute');
  }

  const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

  try {
    const created = await db.Package.create({
      service_id: serviceId,
      name: packageName,
      description: body.description ? String(body.description).trim() : null,
      base_price: price,
      provider_compensation_type: providerCompensationType,
      provider_compensation_value: providerCompensationValue,
      on_demand_provider_compensation_type: onDemandProviderCompensationType,
      on_demand_provider_compensation_value: onDemandProviderCompensationValue,
      duration_minutes: durationMinutes,
      is_active: isActive,
    });

    const pkg = await db.Package.findByPk(created.id, {
      include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
    });
    return formatAdminPackage(pkg);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'A package with this name already exists for the selected service type');
    }
    throw err;
  }
}

async function updateAdminPackage(packageId, body) {
  const id = Number.parseInt(String(packageId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid package id');

  const pkg = await db.Package.findByPk(id, {
    include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
  });
  if (!pkg) throw new HttpError(404, 'Package not found');

  const updates = {};

  if (body.package_name !== undefined || body.name !== undefined) {
    const packageName = String(body.package_name ?? body.name ?? '').trim();
    if (!packageName) throw new HttpError(400, 'Package name cannot be empty');
    updates.name = packageName;
  }

  if (body.price !== undefined || body.base_price !== undefined) {
    const price = Number(body.price ?? body.base_price);
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Price must be a non-negative number');
    updates.base_price = price;
  }

  if (body.provider_compensation_type !== undefined) {
    updates.provider_compensation_type = normalizeCompensationType(body.provider_compensation_type);
  }
  if (body.provider_compensation_value !== undefined) {
    updates.provider_compensation_value = toAmount(body.provider_compensation_value);
  }
  if (body.on_demand_provider_compensation_value !== undefined) {
    updates.on_demand_provider_compensation_value =
      body.on_demand_provider_compensation_value === null ||
      body.on_demand_provider_compensation_value === ''
        ? null
        : toAmount(body.on_demand_provider_compensation_value);
  }
  if (body.on_demand_provider_compensation_type !== undefined) {
    updates.on_demand_provider_compensation_type =
      body.on_demand_provider_compensation_type === null ||
      body.on_demand_provider_compensation_type === ''
        ? null
        : normalizeCompensationType(body.on_demand_provider_compensation_type);
  }
  const nextCompensationType =
    updates.provider_compensation_type ||
    normalizeCompensationType(pkg.provider_compensation_type);
  const nextCompensationValue =
    updates.provider_compensation_value !== undefined
      ? updates.provider_compensation_value
      : toAmount(pkg.provider_compensation_value);
  if (
    nextCompensationType === 'percentage' &&
    (nextCompensationValue < 0 || nextCompensationValue > 100)
  ) {
    throw new HttpError(400, 'Percentage provider compensation must be between 0 and 100');
  }
  if (
    nextCompensationType === 'fixed' &&
    nextCompensationValue < 0
  ) {
    throw new HttpError(400, 'Fixed provider compensation cannot be negative');
  }
  const nextOnDemandCompensationValue =
    updates.on_demand_provider_compensation_value !== undefined
      ? updates.on_demand_provider_compensation_value
      : pkg.on_demand_provider_compensation_value == null
        ? null
        : toAmount(pkg.on_demand_provider_compensation_value);
  const nextOnDemandCompensationType =
    updates.on_demand_provider_compensation_type !== undefined
      ? updates.on_demand_provider_compensation_type
      : pkg.on_demand_provider_compensation_type == null
        ? null
        : normalizeCompensationType(pkg.on_demand_provider_compensation_type);
  if (
    nextOnDemandCompensationValue != null &&
    (nextOnDemandCompensationType || nextCompensationType) === 'percentage' &&
    (nextOnDemandCompensationValue < 0 || nextOnDemandCompensationValue > 100)
  ) {
    throw new HttpError(400, 'On-demand percentage compensation must be between 0 and 100');
  }
  if (
    nextOnDemandCompensationValue != null &&
    (nextOnDemandCompensationType || nextCompensationType) === 'fixed' &&
    nextOnDemandCompensationValue < 0
  ) {
    throw new HttpError(400, 'On-demand fixed compensation cannot be negative');
  }

  if (body.duration_minutes !== undefined) {
    const durationMinutes = Number.parseInt(String(body.duration_minutes), 10);
    if (!durationMinutes || durationMinutes < 1) {
      throw new HttpError(400, 'Duration must be at least 1 minute');
    }
    updates.duration_minutes = durationMinutes;
  }

  if (body.description !== undefined) {
    updates.description = body.description ? String(body.description).trim() : null;
  }

  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (body.service_type !== undefined) {
    updates.service_id = await resolveServiceId(body.service_type);
  }

  if (Object.keys(updates).length === 0) {
    return formatAdminPackage(pkg);
  }

  try {
    await pkg.update(updates);
    await pkg.reload({
      include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
    });
    return formatAdminPackage(pkg);
  } catch (err) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'A package with this name already exists for the selected service type');
    }
    throw err;
  }
}

async function deleteAdminPackage(packageId) {
  const id = Number.parseInt(String(packageId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid package id');

  const pkg = await db.Package.findByPk(id);
  if (!pkg) throw new HttpError(404, 'Package not found');

  const bookingCount = await db.Booking.count({ where: { package_id: id } });
  if (bookingCount > 0) {
    throw new HttpError(
      409,
      'Package cannot be deleted because it is linked to existing bookings. Deactivate it instead.'
    );
  }

  await pkg.destroy();
  return { id };
}

module.exports = {
  SERVICE_TYPES,
  listAdminServices,
  patchAdminService,
  listAdminPackages,
  createAdminPackage,
  updateAdminPackage,
  deleteAdminPackage,
};
