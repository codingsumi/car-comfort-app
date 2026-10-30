const { Op, fn, col } = require('sequelize');
const fs = require('fs');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { ensureAbsoluteUrl, publicPathToDiskPath } = require('../../utils/fileUpload');
const { findDuplicateHints } = require('../vehicleValidation.service');
const { logVehicleActivity } = require('../vehicleActivity.service');
const {
  notifyCustomerVehicleRemoved,
  notifySupportVehicleFlagged,
  notifyAdminsSuspiciousVehicle
} = require('../vehicleNotify.service');

const TERMINAL_BOOKING_STATUSES = ['completed', 'cancelled', 'failed', 'refunded'];

const FLAG_TYPES = new Set([
  'fake_registration',
  'duplicate_vehicle',
  'suspicious_activity',
  'invalid_license_plate',
  'possible_duplicate'
]);

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function logAudit(adminId, actionType, entityType, entityId, details, ip) {
  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: ip
  });
}

function toVehicleImageJson(req, row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    vehicle_id: plain.vehicle_id,
    image_path: plain.image_path,
    url: ensureAbsoluteUrl(req, plain.image_path),
    image_type: plain.image_type,
    is_flagged: plain.is_flagged,
    flagged_by: plain.flagged_by,
    flagged_at: plain.flagged_at,
    created_at: plain.created_at,
    updated_at: plain.updated_at
  };
}

function toVehicleSummaryJson(req, vehicle, extras = {}) {
  const v = vehicle.get ? vehicle.get({ plain: true }) : vehicle;
  const { images: rawImages, user: u, ...rest } = v;
  const images = (rawImages || []).map((img) => toVehicleImageJson(req, img));
  return {
    ...rest,
    images,
    user: u
      ? {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.status,
          role: u.role
        }
      : undefined,
    ...extras
  };
}

async function countActiveBookingsForVehicle(vehicleId, transaction) {
  return db.Booking.count({
    where: {
      vehicle_id: vehicleId,
      status: { [Op.notIn]: TERMINAL_BOOKING_STATUSES }
    },
    transaction
  });
}

async function countCompletedServicesForVehicle(vehicleId, transaction) {
  return db.Booking.count({
    where: {
      vehicle_id: vehicleId,
      status: 'completed'
    },
    transaction
  });
}

async function getVehicleSummaryExtras(vehicleId, transaction) {
  const [active_bookings_count, completed_services_count] = await Promise.all([
    countActiveBookingsForVehicle(vehicleId, transaction),
    countCompletedServicesForVehicle(vehicleId, transaction)
  ]);
  return { active_bookings_count, completed_services_count };
}

async function getSummary(req, res, next) {
  try {
    const nonRemoved = { status: { [Op.ne]: 'removed' } };

    const [
      total_registered,
      active_vehicles,
      vehicles_with_active_bookings,
      flagged_vehicle_count,
      top_makes,
      recentVehicles,
      openFlagRows
    ] = await Promise.all([
      db.Vehicle.count({ where: nonRemoved }),
      db.Vehicle.count({ where: { status: 'active' } }),
      db.Booking.count({
        distinct: true,
        col: 'vehicle_id',
        where: {
          vehicle_id: { [Op.ne]: null },
          status: { [Op.notIn]: TERMINAL_BOOKING_STATUSES }
        }
      }),
      db.sequelize.query(
        `SELECT COUNT(DISTINCT vf.vehicle_id) AS cnt
         FROM vehicle_flags vf
         INNER JOIN vehicles v ON v.id = vf.vehicle_id AND v.status != 'removed'
         WHERE vf.review_status IN ('open','investigating')`,
        { type: db.sequelize.QueryTypes.SELECT }
      ).then((rows) => Number(rows?.[0]?.cnt || 0)),
      db.Vehicle.findAll({
        attributes: ['make', [fn('COUNT', col('Vehicle.id')), 'cnt']],
        where: nonRemoved,
        group: ['make'],
        order: [[fn('COUNT', col('Vehicle.id')), 'DESC']],
        limit: 5,
        raw: true
      }),
      db.Vehicle.findAll({
        where: nonRemoved,
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
          { model: db.VehicleImage, as: 'images', limit: 1, separate: true }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      }),
      db.VehicleFlag.findAll({
        where: { review_status: { [Op.in]: ['open', 'investigating'] } },
        attributes: ['id', 'vehicle_id', 'flag_type', 'review_status', 'created_at'],
        include: [{ model: db.Vehicle, as: 'vehicle', attributes: ['id', 'make', 'model', 'license_plate'] }],
        order: [['created_at', 'DESC']],
        limit: 10
      })
    ]);

    return res.success('Summary', {
      total_registered,
      active_vehicles,
      vehicles_with_active_bookings,
      flagged_vehicle_count,
      top_makes: (top_makes || []).map((r) => ({ make: r.make, count: Number(r.cnt) })),
      recently_added: recentVehicles.map((v) => toVehicleSummaryJson(req, v)),
      open_flags_sample: openFlagRows.map((f) => {
        const p = f.get({ plain: true });
        return {
          id: p.id,
          vehicle_id: p.vehicle_id,
          flag_type: p.flag_type,
          review_status: p.review_status,
          created_at: p.created_at,
          vehicle: p.vehicle
        };
      })
    });
  } catch (e) {
    return next(e);
  }
}

function buildListWhere(query) {
  const {
    search,
    make,
    vehicle_type,
    year_from,
    year_to,
    status,
    flagged_only,
    date_from,
    date_to
  } = query;

  const where = {};

  if (status) {
    where.status = status;
  } else {
    where.status = { [Op.ne]: 'removed' };
  }

  if (make) {
    where.make = { [Op.like]: `%${make}%` };
  }

  if (vehicle_type) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      db.sequelize.where(
        db.sequelize.fn('LOWER', db.sequelize.col('vehicle_type')),
        String(vehicle_type).trim().toLowerCase()
      ),
    ];
  }

  if (year_from) {
    where.year = { ...where.year, [Op.gte]: Number.parseInt(year_from, 10) };
  }
  if (year_to) {
    where.year = { ...where.year, [Op.lte]: Number.parseInt(year_to, 10) };
  }

  if (date_from) {
    where.created_at = { ...where.created_at, [Op.gte]: new Date(date_from) };
  }
  if (date_to) {
    const end = new Date(date_to);
    end.setHours(23, 59, 59, 999);
    where.created_at = { ...where.created_at, [Op.lte]: end };
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim()}%`;
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { license_plate: { [Op.like]: term } },
        { license_plate_normalized: { [Op.like]: term.toUpperCase() } },
        { vin_number: { [Op.like]: term.toUpperCase() } },
        { make: { [Op.like]: term } },
        { model: { [Op.like]: term } },
        { '$user.name$': { [Op.like]: term } },
        { '$user.email$': { [Op.like]: term } }
      ]
    });
  }

  const include = [
    {
      model: db.User,
      as: 'user',
      attributes: ['id', 'name', 'email', 'phone', 'status'],
      where: { role: 'customer' }
    },
    { model: db.VehicleImage, as: 'images', separate: true, order: [['created_at', 'ASC']] }
  ];

  if (String(flagged_only).toLowerCase() === 'true' || flagged_only === '1') {
    include.push({
      model: db.VehicleFlag,
      as: 'flags',
      required: true,
      where: { review_status: { [Op.in]: ['open', 'investigating'] } },
      attributes: ['id']
    });
  }

  return { where, include };
}

async function listVehicles(req, res, next) {
  try {
    const fmt = String(req.query.format || '').toLowerCase();
    const { page = 1, limit = 10, sort = 'created_at', order = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum =
      fmt === 'csv'
        ? Math.min(5000, Math.max(1, parseInt(limit || 2000, 10)))
        : Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const validSortFields = ['created_at', 'make', 'model', 'year', 'license_plate', 'status', 'vehicle_type'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const { where, include } = buildListWhere(req.query);

    const { count, rows } = await db.Vehicle.findAndCountAll({
      where,
      include,
      distinct: true,
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset
    });

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const extras = await getVehicleSummaryExtras(row.id);
        const openFlags = await db.VehicleFlag.count({
          where: {
            vehicle_id: row.id,
            review_status: { [Op.in]: ['open', 'investigating'] }
          }
        });
        return toVehicleSummaryJson(req, row, { ...extras, open_flag_count: openFlags });
      })
    );

    if (fmt === 'csv') {
      const headers = [
        'id',
        'customer_name',
        'email',
        'make',
        'model',
        'year',
        'color',
        'license_plate',
        'vin_number',
        'vehicle_type',
        'status',
        'active_bookings',
        'completed_services',
        'created_at'
      ];
      const lines = [headers.join(',')];
      for (const r of enriched) {
        const c = (x) => {
          if (x === null || x === undefined) return '';
          const s = String(x);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        lines.push(
          [
            r.id,
            c(r.user?.name),
            c(r.user?.email),
            c(r.make),
            c(r.model),
            r.year,
            c(r.color),
            c(r.license_plate),
            c(r.vin_number),
            c(r.vehicle_type),
            c(r.status),
            r.active_bookings_count,
            r.completed_services_count,
            c(r.created_at)
          ].join(',')
        );
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="vehicles.csv"');
      return res.send(lines.join('\n'));
    }

    return res.success('Vehicles fetched', {
      rows: enriched,
      count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return next(err);
  }
}

async function getVehicleById(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) throw new HttpError(400, 'Invalid id');

    const vehicle = await db.Vehicle.findByPk(id, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status', 'role', 'created_at'] },
        { model: db.VehicleImage, as: 'images', separate: true, order: [['created_at', 'ASC']] },
        {
          model: db.VehicleFlag,
          as: 'flags',
          separate: true,
          order: [['created_at', 'DESC']],
          include: [
            { model: db.User, as: 'flagger', attributes: ['id', 'name', 'email'] },
            { model: db.User, as: 'resolver', attributes: ['id', 'name', 'email'] }
          ]
        }
      ]
    });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const customerId = vehicle.user_id;
    const [vehicleCount, bookingCount, extras, duplicate_hints, platformReports] = await Promise.all([
      db.Vehicle.count({ where: { user_id: customerId, status: { [Op.ne]: 'removed' } } }),
      db.Booking.count({
        where: {
          [Op.or]: [{ user_id: customerId }, { customer_id: customerId }]
        }
      }),
      getVehicleSummaryExtras(id),
      findDuplicateHints({
        vehicleId: id,
        userId: customerId,
        vin: vehicle.vin_number,
        licensePlateNormalized: vehicle.license_plate_normalized,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year
      }),
      db.sequelize.query(
        `SELECT pr.id, pr.report_type, pr.status, pr.priority, pr.description, pr.created_at, b.id AS booking_id, b.booking_code, b.status AS booking_status
         FROM platform_reports pr
         INNER JOIN bookings b ON b.id = pr.booking_id
         WHERE b.vehicle_id = :vid
         ORDER BY pr.created_at DESC
         LIMIT 20`,
        {
          replacements: { vid: id },
          type: db.sequelize.QueryTypes.SELECT
        }
      )
    ]);

    const activity = await db.VehicleActivityLog.findAll({
      where: { vehicle_id: id },
      order: [['created_at', 'DESC']],
      limit: 100
    });

    const bookingsPage = Number.parseInt(req.query.bookings_page, 10) || 1;
    const bookingsLimit = Math.min(50, Math.max(5, Number.parseInt(req.query.bookings_limit, 10) || 10));
    const bookingsOffset = (bookingsPage - 1) * bookingsLimit;

    const bookingWhere = {
      vehicle_id: id,
      ...(req.query.booking_status ? { status: req.query.booking_status } : {})
    };

    const { count: bookingRowsCount, rows: bookingRows } = await db.Booking.findAndCountAll({
      where: bookingWhere,
      include: [
        { model: db.Package, as: 'package', attributes: ['id', 'name'] },
        {
          model: db.User,
          as: 'assigned_driver',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: bookingsLimit,
      offset: bookingsOffset
    });

    const service_history = bookingRows.map((b) => {
      const p = b.get({ plain: true });
      return {
        booking_id: p.id,
        booking_code: p.booking_code,
        service_type: p.service_type,
        provider: p.assigned_driver
          ? { id: p.assigned_driver.id, name: p.assigned_driver.name }
          : null,
        booking_date: p.service_datetime || p.scheduled_at || p.created_at,
        amount: p.total_price,
        status: p.status
      };
    });

    return res.success('Vehicle fetched', {
      vehicle: toVehicleSummaryJson(req, vehicle, {
        ...extras,
        duplicate_hints,
        customer_summary: {
          total_vehicles_owned: vehicleCount,
          total_bookings: bookingCount
        },
        activity_timeline: activity.map((a) => a.get({ plain: true })),
        service_history,
        service_history_pagination: {
          count: bookingRowsCount,
          page: bookingsPage,
          totalPages: Math.ceil(bookingRowsCount / bookingsLimit),
          limit: bookingsLimit
        },
        related_platform_reports: (platformReports || []).map((pr) => ({
          id: pr.id,
          report_type: pr.report_type,
          status: pr.status,
          priority: pr.priority,
          description: pr.description,
          created_at: pr.created_at,
          booking: {
            id: pr.booking_id,
            booking_code: pr.booking_code,
            status: pr.booking_status
          }
        }))
      })
    });
  } catch (e) {
    return next(e);
  }
}

async function patchVehicleStatus(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = Number.parseInt(req.params.id, 10);
    const adminId = req.auth?.userId;
    const { status, notes } = req.body || {};
    if (!id) throw new HttpError(400, 'Invalid id');
    if (!['active', 'inactive', 'removed', 'flagged'].includes(status)) {
      throw new HttpError(400, 'Invalid status');
    }

    const vehicle = await db.Vehicle.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const prev = vehicle.status;
    const updates = { status };
    if (notes !== undefined) {
      updates.notes = notes === null || notes === '' ? null : String(notes).slice(0, 5000);
    }

    if (status === 'removed') {
      throw new HttpError(400, 'Use DELETE /admin/vehicles/:id to remove a vehicle');
    }

    await vehicle.update(updates, { transaction: t });
    await logVehicleActivity(
      {
        vehicleId: id,
        activityType: 'vehicle_status_changed',
        actorType: 'admin',
        actorId: adminId,
        metadata: { from: prev, to: status }
      },
      { transaction: t }
    );

    await logAudit(adminId, 'vehicle_status_update', 'vehicle', id, { from: prev, to: status, notes: updates.notes }, getClientIp(req));

    await t.commit();
    const refreshed = await db.Vehicle.findByPk(id, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: db.VehicleImage, as: 'images', separate: true }
      ]
    });
    return res.success('Vehicle updated', toVehicleSummaryJson(req, refreshed, await getVehicleSummaryExtras(id)));
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function removeVehicle(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const id = Number.parseInt(req.params.id, 10);
    const adminId = req.auth?.userId;
    const reason = req.body?.reason != null ? String(req.body.reason).trim() : '';
    if (!id) throw new HttpError(400, 'Invalid id');
    if (!reason || reason.length < 3) throw new HttpError(400, 'removal reason is required');

    const vehicle = await db.Vehicle.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');
    if (vehicle.status === 'removed') throw new HttpError(400, 'Vehicle already removed');

    const activeBookings = await countActiveBookingsForVehicle(id, t);
    if (activeBookings > 0) {
      throw new HttpError(409, 'Cannot remove vehicle with active bookings');
    }

    await vehicle.update(
      {
        status: 'removed',
        removed_at: new Date(),
        removal_reason: reason.slice(0, 2000)
      },
      { transaction: t }
    );

    await logVehicleActivity(
      {
        vehicleId: id,
        activityType: 'vehicle_removed',
        actorType: 'admin',
        actorId: adminId,
        metadata: { reason }
      },
      { transaction: t }
    );

    await logAudit(adminId, 'vehicle_soft_delete', 'vehicle', id, { reason }, getClientIp(req));

    await t.commit();

    const label = `${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`;
    await notifyCustomerVehicleRemoved({
      customerUserId: vehicle.user_id,
      vehicleLabel: label,
      removalReason: reason
    });

    return res.success('Vehicle removed from customer account', { id });
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function deleteVehicleImage(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const vehicleId = Number.parseInt(req.params.id, 10);
    const imageId = Number.parseInt(req.params.imageId, 10);
    const adminId = req.auth?.userId;

    const img = await db.VehicleImage.findOne({ where: { id: imageId, vehicle_id: vehicleId }, transaction: t });
    if (!img) throw new HttpError(404, 'Image not found');

    const diskPath = publicPathToDiskPath(img.image_path);
    await img.destroy({ transaction: t });
    await logVehicleActivity(
      {
        vehicleId,
        activityType: 'image_removed',
        actorType: 'admin',
        actorId: adminId,
        metadata: { image_id: imageId }
      },
      { transaction: t }
    );
    await logAudit(adminId, 'vehicle_image_delete', 'vehicle', vehicleId, { image_id: imageId }, getClientIp(req));
    await t.commit();

    if (diskPath) {
      try {
        fs.unlinkSync(diskPath);
      } catch {
        // ignore
      }
    }

    return res.success('Image removed', {});
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function flagVehicleImage(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const vehicleId = Number.parseInt(req.params.id, 10);
    const imageId = Number.parseInt(req.params.imageId, 10);
    const adminId = req.auth?.userId;
    const { is_flagged } = req.body || {};

    const img = await db.VehicleImage.findOne({ where: { id: imageId, vehicle_id: vehicleId }, transaction: t });
    if (!img) throw new HttpError(404, 'Image not found');

    const flagged = Boolean(is_flagged);
    await img.update(
      {
        is_flagged: flagged,
        flagged_by: flagged ? adminId : null,
        flagged_at: flagged ? new Date() : null
      },
      { transaction: t }
    );

    await logVehicleActivity(
      {
        vehicleId,
        activityType: flagged ? 'image_flagged' : 'image_unflagged',
        actorType: 'admin',
        actorId: adminId,
        metadata: { image_id: imageId }
      },
      { transaction: t }
    );
    await logAudit(
      adminId,
      flagged ? 'vehicle_image_flag' : 'vehicle_image_unflag',
      'vehicle',
      vehicleId,
      { image_id: imageId },
      getClientIp(req)
    );

    await t.commit();
    return res.success('Image updated', toVehicleImageJson(req, img));
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function createVehicleFlag(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const vehicleId = Number.parseInt(req.params.id, 10);
    const adminId = req.auth?.userId;
    const { flag_type, reason, review_status } = req.body || {};
    if (!vehicleId) throw new HttpError(400, 'Invalid id');
    if (!FLAG_TYPES.has(flag_type)) throw new HttpError(400, 'Invalid flag_type');

    const vehicle = await db.Vehicle.findByPk(vehicleId, { transaction: t });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const status =
      review_status && ['open', 'investigating', 'resolved', 'dismissed'].includes(review_status)
        ? review_status
        : 'open';

    const row = await db.VehicleFlag.create(
      {
        vehicle_id: vehicleId,
        flag_type,
        reason: reason != null ? String(reason).slice(0, 5000) : null,
        review_status: status,
        flagged_by: adminId
      },
      { transaction: t }
    );

    if (status === 'open' || status === 'investigating') {
      await vehicle.update({ status: 'flagged' }, { transaction: t });
    }

    await logVehicleActivity(
      {
        vehicleId,
        activityType: 'vehicle_flagged',
        actorType: 'admin',
        actorId: adminId,
        metadata: { flag_type, flag_id: row.id }
      },
      { transaction: t }
    );
    await logAudit(adminId, 'vehicle_flag_create', 'vehicle', vehicleId, { flag_type, flag_id: row.id }, getClientIp(req));
    await t.commit();

    await notifySupportVehicleFlagged({
      vehicleId,
      subject: `Vehicle flagged: ${flag_type}`,
      body: `Vehicle #${vehicleId} (${vehicle.make} ${vehicle.license_plate}). Reason: ${reason || 'n/a'}`
    });
    await notifyAdminsSuspiciousVehicle({
      vehicleId,
      summary: `Vehicle #${vehicleId} was flagged as ${flag_type}. Check Vehicles in admin.`
    });

    const withAssocs = await db.VehicleFlag.findByPk(row.id, {
      include: [
        { model: db.User, as: 'flagger', attributes: ['id', 'name', 'email'] },
        { model: db.Vehicle, as: 'vehicle', attributes: ['id', 'make', 'model', 'license_plate'] }
      ]
    });

    return res.success('Flag created', withAssocs.get({ plain: true }));
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function patchVehicleFlag(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const flagId = Number.parseInt(req.params.flagId, 10);
    const adminId = req.auth?.userId;
    const { review_status, resolution_notes } = req.body || {};

    const flag = await db.VehicleFlag.findByPk(flagId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!flag) throw new HttpError(404, 'Flag not found');

    const updates = {};
    if (review_status) {
      if (!['open', 'investigating', 'resolved', 'dismissed'].includes(review_status)) {
        throw new HttpError(400, 'Invalid review_status');
      }
      updates.review_status = review_status;
      if (review_status === 'resolved' || review_status === 'dismissed') {
        updates.resolved_by = adminId;
        updates.resolved_at = new Date();
      }
    }
    if (resolution_notes !== undefined) {
      updates.resolution_notes =
        resolution_notes === null || resolution_notes === '' ? null : String(resolution_notes).slice(0, 5000);
    }

    await flag.update(updates, { transaction: t });

    const vehicleId = flag.vehicle_id;
    if (updates.review_status) {
      const openCount = await db.VehicleFlag.count({
        where: {
          vehicle_id: vehicleId,
          review_status: { [Op.in]: ['open', 'investigating'] }
        },
        transaction: t
      });
      if (openCount === 0) {
        const v = await db.Vehicle.findByPk(vehicleId, { transaction: t });
        if (v && v.status === 'flagged') {
          await v.update({ status: 'active' }, { transaction: t });
        }
      }
    }

    await logVehicleActivity(
      {
        vehicleId,
        activityType: 'flag_status_updated',
        actorType: 'admin',
        actorId: adminId,
        metadata: { flag_id: flagId, ...updates }
      },
      { transaction: t }
    );
    await logAudit(
      adminId,
      'vehicle_flag_update',
      'vehicle',
      vehicleId,
      { flag_id: flagId, ...updates },
      getClientIp(req)
    );

    await t.commit();
    const refreshed = await db.VehicleFlag.findByPk(flagId, {
      include: [{ model: db.User, as: 'flagger', attributes: ['id', 'name'] }]
    });
    return res.success('Flag updated', refreshed.get({ plain: true }));
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function unflagVehicle(req, res, next) {
  const t = await db.sequelize.transaction();
  try {
    const vehicleId = Number.parseInt(req.params.id, 10);
    const adminId = req.auth?.userId;
    const { resolution_notes } = req.body || {};
    if (!vehicleId) throw new HttpError(400, 'Invalid id');

    const vehicle = await db.Vehicle.findByPk(vehicleId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const openFlags = await db.VehicleFlag.findAll({
      where: {
        vehicle_id: vehicleId,
        review_status: { [Op.in]: ['open', 'investigating'] },
      },
      transaction: t,
    });

    const defaultNote = 'Cleared by admin (vehicle unflagged)';
    const note =
      resolution_notes != null && String(resolution_notes).trim()
        ? String(resolution_notes).trim().slice(0, 5000)
        : defaultNote;

    for (const flag of openFlags) {
      await flag.update(
        {
          review_status: 'dismissed',
          resolved_by: adminId,
          resolved_at: new Date(),
          resolution_notes: flag.resolution_notes || note,
        },
        { transaction: t }
      );
    }

    const previousStatus = vehicle.status;
    let nextStatus = previousStatus;
    if (vehicle.status === 'flagged') {
      await vehicle.update({ status: 'active' }, { transaction: t });
      nextStatus = 'active';
    }

    await logVehicleActivity(
      {
        vehicleId,
        activityType: 'vehicle_unflagged',
        actorType: 'admin',
        actorId: adminId,
        metadata: {
          flags_cleared: openFlags.length,
          previous_status: previousStatus,
          status: nextStatus,
        },
      },
      { transaction: t }
    );
    await logAudit(
      adminId,
      'vehicle_unflag',
      'vehicle',
      vehicleId,
      { flags_cleared: openFlags.length, previous_status: previousStatus, status: nextStatus },
      getClientIp(req)
    );

    await t.commit();
    return res.success('Vehicle unflagged', {
      vehicle_id: vehicleId,
      flags_cleared: openFlags.length,
      status: nextStatus,
    });
  } catch (e) {
    await t.rollback();
    return next(e);
  }
}

async function listFlaggedVehicles(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await db.VehicleFlag.findAndCountAll({
      where: { review_status: { [Op.in]: ['open', 'investigating'] } },
      include: [
        {
          model: db.Vehicle,
          as: 'vehicle',
          required: true,
          where: { status: { [Op.ne]: 'removed' } },
          include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }]
        },
        { model: db.User, as: 'flagger', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return res.success('Flagged vehicles', {
      rows: rows.map((r) => r.get({ plain: true })),
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getSummary,
  listVehicles,
  getVehicleById,
  patchVehicleStatus,
  removeVehicle,
  deleteVehicleImage,
  flagVehicleImage,
  createVehicleFlag,
  patchVehicleFlag,
  unflagVehicle,
  listFlaggedVehicles
};
