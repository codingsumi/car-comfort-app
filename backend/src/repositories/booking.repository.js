const db = require('../models');
const { HttpError } = require('../utils/httpError');

async function getBookingOrThrow({ bookingId, userId, transaction, lock }) {
  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid booking id');

  const booking = await db.Booking.findOne({
    where: { id, ...(userId ? { user_id: userId } : {}) },
    transaction,
    lock
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  return booking;
}

async function createDraftBooking({ userId, body, transaction }) {
  const draftPayload = {
    user_id: userId || null,
    customer_id: userId || null,
    service_type: body.service_type,
    address: body.address,
    latitude: body.latitude,
    longitude: body.longitude,
    service_address: body.service_address,
    service_latitude: body.service_latitude,
    service_longitude: body.service_longitude,
    service_location_name: body.service_location_name ?? null,
    service_lat: body.service_latitude ?? body.latitude ?? null,
    service_lng: body.service_longitude ?? body.longitude ?? null,
    ev_charging_address: body.ev_charging_address ?? null,
    charging_latitude: body.charging_latitude ?? null,
    charging_longitude: body.charging_longitude ?? null,
    ev_charging_location_name: body.ev_charging_location_name ?? null,
    charger_type: body.charger_type ?? null,
    ev_account_card_on_file: body.ev_account_card_on_file ?? null,
    package_id: null,
    custom_package_name: null,
    custom_price: null,
    schedule_type: null,
    scheduled_at: null,
    service_datetime: null,
    vehicle_id: null,
    vehicle_charge_limit: null,
    current_battery_charge: null,
    current_battery_status: null,
    rate_per_kw: null,
    parking_instructions: null,
    notes: null,
    base_price: null,
    base_price_before_discount: null,
    referral_discount_amount: 0,
    referral_discount_type: null,
    service_fee: 0,
    platform_fee: 0,
    convenience_fee: 0,
    on_demand_fee: 0,
    towing_fee: 0,
    tax: 0,
    total_price: null,
    assigned_driver_user_id: null,
    provider_id: null,
    tracking_status: null,
    pickup_otp: null,
    pickup_otp_expiry: null,
    status: 'draft'
  };

  let booking = null;
  if (userId) {
    await db.User.findByPk(userId, {
      attributes: ['id'],
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });

    booking = await db.Booking.findOne({
      where: { user_id: userId, status: 'draft' },
      order: [['updated_at', 'DESC'], ['id', 'DESC']],
      transaction,
      lock: transaction?.LOCK?.UPDATE
    });
  }

  if (booking) {
    await Promise.all([
      db.BookingAddonMap.destroy({ where: { booking_id: booking.id }, transaction }),
      db.BookingImage.destroy({ where: { booking_id: booking.id }, transaction })
    ]);
    await booking.update(draftPayload, { transaction });
  } else {
    booking = await db.Booking.create(draftPayload, { transaction });
  }

  return booking;
}

async function updateBooking({ bookingId, userId, updates, transaction, lock }) {
  const booking = await getBookingOrThrow({ bookingId, userId, transaction, lock });
  await booking.update(updates, { transaction });
  return booking;
}

async function getReviewBundle({ bookingId, userId }) {
  const id = Number.parseInt(String(bookingId), 10);
  if (!id || id < 1) throw new HttpError(400, 'Invalid booking id');

  const booking = await db.Booking.findOne({
    where: { id, ...(userId ? { user_id: userId } : {}) },
    include: [
      {
        model: db.Package,
        as: 'package',
        include: [{ model: db.Service, as: 'service', attributes: ['id', 'name'] }]
      },
      { model: db.Vehicle, as: 'vehicle', include: [{ model: db.VehicleImage, as: 'images' }] },
      { model: db.AddOn, as: 'addons', through: { attributes: [] } },
      { model: db.BookingImage, as: 'images' }
    ],
    distinct: true
  });
  if (!booking) throw new HttpError(404, 'Booking not found');
  return booking.get({ plain: true });
}

module.exports = {
  getBookingOrThrow,
  createDraftBooking,
  updateBooking,
  getReviewBundle
};
