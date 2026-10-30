const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sendBookingConfirmedNotifications } = require('./bookingNotification.service');
const { notifyCustomerBookingConfirmed } = require('./bookingCustomerNotify.service');
const { handleBookingStatusWalletTransition } = require('./providerWallet.service');
const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');
const { logger } = require('../config/logger');
const { captureBookingChatOnCompletion } = require('./bookingChat.service');

const SERVICE_TYPES = new Set(['car_wash', 'ev_charging', 'combo']);

function packageAllowedForBookingServiceType(packageServiceName, bookingServiceType) {
  const pkgSvc = String(packageServiceName || '').trim();
  const bookingSvc = String(bookingServiceType || '').trim();
  if (pkgSvc === bookingSvc) return true;
  if (bookingSvc === 'combo' && pkgSvc === 'car_wash') return true;
  return false;
}
const SCHEDULE_TYPES = new Set(['asap', 'scheduled', 'on_demand']);
const STATUSES = new Set(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']);

function parseId(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  if (!n || n < 1) throw new HttpError(400, `${name} is invalid`);
  return n;
}

function parsePrice(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${name} is invalid`);
  return n;
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const pageSizeRaw = Number.parseInt(String(query.page_size || query.pageSize || '20'), 10) || 20;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

async function assertAddonsExist(addonIds) {
  if (!addonIds.length) return [];
  const rows = await db.AddOn.findAll({ where: { id: addonIds } });
  if (rows.length !== addonIds.length) throw new HttpError(400, 'Invalid addon IDs');
  return rows.map((r) => r.get({ plain: true }));
}

async function assertAddonsAllowedForPackage({ packageId, addonIds }) {
  if (!packageId || !addonIds.length) return;
  const maps = await db.PackageAddonMap.findAll({
    where: { package_id: packageId, addon_id: addonIds },
    attributes: ['addon_id']
  });
  if (maps.length !== addonIds.length) throw new HttpError(400, 'One or more addons are not allowed for this package');
}

function computeTotalPrice({ basePrice, addons }) {
  const addOnTotal = (addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
  return Number(basePrice || 0) + addOnTotal;
}

async function createBooking({ authUserId, body }) {
  const service_type = String(body.service_type || '').trim();
  if (!SERVICE_TYPES.has(service_type)) throw new HttpError(400, 'Invalid service type');

  const package_id = parseId(body.package_id, 'package_id');
  const custom_package_name = body.custom_package_name === null ? null : String(body.custom_package_name || '').trim() || null;
  const custom_price = parsePrice(body.custom_price, 'custom_price');

  const schedule_type = String(body.schedule_type || '').trim();
  if (!SCHEDULE_TYPES.has(schedule_type)) throw new HttpError(400, 'Invalid schedule type');

  const scheduled_at = body.scheduled_at ? new Date(body.scheduled_at) : null;
  if (schedule_type === 'scheduled') {
    if (!scheduled_at || Number.isNaN(scheduled_at.getTime())) throw new HttpError(400, 'scheduled_at is required');
  }

  const service_address = body.service_address === null ? null : String(body.service_address || '').trim() || null;
  const service_latitude = body.service_latitude === undefined || body.service_latitude === null || body.service_latitude === '' ? null : Number(body.service_latitude);
  const service_longitude =
    body.service_longitude === undefined || body.service_longitude === null || body.service_longitude === '' ? null : Number(body.service_longitude);
  if ((service_latitude === null) !== (service_longitude === null)) {
    throw new HttpError(400, 'Either both (service_latitude and service_longitude) are required');
  }
  if (service_latitude !== null && (!Number.isFinite(service_latitude) || service_latitude < -90 || service_latitude > 90)) {
    throw new HttpError(400, 'service_latitude is invalid');
  }
  if (service_longitude !== null && (!Number.isFinite(service_longitude) || service_longitude < -180 || service_longitude > 180)) {
    throw new HttpError(400, 'service_longitude is invalid');
  }

  const addons = Array.isArray(body.addons) ? body.addons : [];
  const addonIds = [...new Set(addons.map((a) => Number.parseInt(String(a), 10)).filter((n) => n && n > 0))];

  // Either package_id OR custom name+price required (but not both).
  const hasPackage = !!package_id;
  const hasCustom = !!(custom_package_name && custom_price !== null);
  if (!hasPackage && !hasCustom) {
    throw new HttpError(400, 'Either package_id or (custom_package_name + custom_price) is required');
  }
  if (hasPackage && (custom_package_name || custom_price !== null)) {
    throw new HttpError(400, 'Provide either package_id or custom_package fields, not both');
  }

  const { sequelize, Booking, BookingAddonMap } = db;
  const t = await sequelize.transaction();

  try {
    let pkg = null;
    let basePrice = 0;
    let durationMinutes = null;

    if (package_id) {
      pkg = await db.Package.findByPk(package_id, {
        include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!pkg) throw new HttpError(400, 'Invalid package_id');
      if (!packageAllowedForBookingServiceType(pkg.service?.name, service_type)) {
        throw new HttpError(400, 'package_id does not belong to service_type');
      }
      basePrice = Number(pkg.base_price || 0);
      durationMinutes = Number(pkg.duration_minutes || 0);
    } else {
      basePrice = Number(custom_price || 0);
    }

    const addOnRows = await assertAddonsExist(addonIds);
    if (package_id) await assertAddonsAllowedForPackage({ packageId: package_id, addonIds });

    const booking = await Booking.create(
      {
        user_id: authUserId || null,
        service_type,
        package_id: package_id || null,
        custom_package_name,
        custom_price: custom_price === null ? null : custom_price,
        schedule_type,
        scheduled_at: schedule_type === 'scheduled' ? scheduled_at : null,
        service_address,
        service_latitude,
        service_longitude,
        status: 'pending'
      },
      { transaction: t }
    );

    for (const addon_id of addonIds) {
      await BookingAddonMap.create({ booking_id: booking.id, addon_id }, { transaction: t });
    }

    await t.commit();

    return {
      booking_id: booking.id,
      service_type,
      package_id: package_id || null,
      custom_package_name,
      custom_price: custom_price === null ? null : custom_price,
      schedule_type,
      scheduled_at: schedule_type === 'scheduled' ? scheduled_at : null,
      service_address,
      service_latitude,
      service_longitude,
      status: 'pending',
      duration_minutes: durationMinutes,
      total_price: computeTotalPrice({ basePrice, addons: addOnRows }),
      addons: addOnRows
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listBookings({ authUserId, query }) {
  const { page, pageSize, offset } = parsePagination(query || {});

  const where = { status: { [Op.ne]: 'draft' } };
  if (authUserId) where.user_id = authUserId;

  const { rows, count } = await db.Booking.findAndCountAll({
    where,
    include: [
      {
        model: db.Package,
        as: 'package',
        attributes: ['id', 'name', 'base_price', 'duration_minutes'],
        include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }]
      },
      { model: db.AddOn, as: 'addons', attributes: ['id', 'name', 'price'], through: { attributes: [] } }
    ],
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset,
    distinct: true
  });

  const bookings = rows.map((b) => {
    const plain = b.get({ plain: true });
    const basePrice = plain.package_id ? Number(plain.package?.base_price || 0) : Number(plain.custom_price || 0);
    const duration = plain.package_id ? Number(plain.package?.duration_minutes || 0) : null;
    const total = computeTotalPrice({ basePrice, addons: plain.addons || [] });
    return {
      ...plain,
      duration_minutes: duration,
      total_price: total
    };
  });

  return {
    pagination: { page, page_size: pageSize, total: count },
    bookings
  };
}

async function updateBookingStatus({ bookingId, status, authUserId }) {
  const id = parseId(bookingId, 'booking id');
  const nextStatus = String(status || '').trim();
  if (!STATUSES.has(nextStatus)) throw new HttpError(400, 'Invalid status');

  const booking = await db.Booking.findByPk(id);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (authUserId && booking.user_id && Number(booking.user_id) !== Number(authUserId)) {
    throw new HttpError(403, 'Forbidden');
  }

  const prevStatus = booking.status;
  await booking.update({ status: nextStatus });
  await booking.reload();

  if (prevStatus !== 'completed' && nextStatus === 'completed') {
    captureBookingChatOnCompletion(id).catch((err) => {
      logger.error('booking_status_chat_capture_failed', { bookingId: id, message: err?.message });
    });
  }

  await handleBookingStatusWalletTransition({
    booking,
    previousStatus: prevStatus,
    transaction: null
  });

  // If status transitions to confirmed, send confirmation email + SMS (best-effort).
  if (prevStatus !== 'confirmed' && nextStatus === 'confirmed') {
    const confirmedPlain = booking.get({ plain: true });
    await sendBookingConfirmedNotifications({ booking: confirmedPlain });
    notifyCustomerBookingConfirmed({ booking: confirmedPlain, userId: confirmedPlain.user_id }).catch(
      (err) => {
        logger.error('notifyCustomerBookingConfirmed failed', {
          bookingId: id,
          message: err?.message,
        });
      }
    );
  }

  if (nextStatus === 'completed' || nextStatus === 'cancelled') {
    const customerId = Number(booking.customer_id || booking.user_id || 0);
    if (customerId > 0) {
      const statusMessages = {
        completed: 'Your booking has been completed successfully',
        cancelled: 'Your booking has been cancelled'
      };
      emitToCustomer(customerId, 'booking_status_update', {
        booking_id: id,
        booking_status: nextStatus.toUpperCase(),
        message: statusMessages[nextStatus],
        driver: null,
        updated_at: new Date().toISOString()
      });
    }
  }

  return booking.get({ plain: true });
}

module.exports = {
  createBooking,
  listBookings,
  updateBookingStatus
};

