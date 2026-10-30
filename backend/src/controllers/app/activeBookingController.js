'use strict';

const { Op } = require('sequelize');
const db = require('../../models');
const { formatPublicAvgRating, getRatingSummariesByUserIds } = require('../../services/review.service');
const { resolveEstimatedTravelMiles } = require('../../utils/driverJobMapSummary');

const ACTIVE_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'in_progress'];

function resolveAddresses(plain) {
  const serviceType = (plain.service_type || '').trim();
  const pickupAddress = plain.address || null;
  let serviceAddress = null;
  let serviceLocationName = null;
  let chargeLimit = null;

  if (serviceType === 'ev_charging') {
    serviceAddress = plain.ev_charging_address || plain.service_address || null;
    serviceLocationName = plain.ev_charging_location_name || null;
    chargeLimit = plain.vehicle_charge_limit != null ? Number(plain.vehicle_charge_limit) : null;
  } else if (serviceType === 'car_wash') {
    serviceAddress = plain.service_address || null;
    serviceLocationName = plain.service_location_name || null;
  } else if (serviceType === 'combo') {
    serviceAddress = plain.ev_charging_address || plain.service_address || null;
    serviceLocationName = plain.ev_charging_location_name || plain.service_location_name || null;
    chargeLimit = plain.vehicle_charge_limit != null ? Number(plain.vehicle_charge_limit) : null;
  }

  return { pickupAddress, serviceAddress, serviceLocationName, chargeLimit };
}

async function getCustomerActiveBooking(req, res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (String(req.auth?.role || '').trim() !== 'customer') {
      return res.status(403).json({ message: 'Only customers can use this endpoint' });
    }

    const includeDriver = [
      {
        model: db.User,
        as: 'assigned_driver',
        required: false,
        attributes: ['id', 'name', 'phone'],
        include: [
          {
            model: db.DriverProfile,
            as: 'driver_profile',
            required: false,
            attributes: ['profile_picture'],
          },
        ],
      },
    ];

    // Priority 1: latest active booking
    let booking = await db.Booking.findOne({
      where: { user_id: { [Op.eq]: userId }, status: { [Op.in]: ACTIVE_STATUSES } },
      order: [['updated_at', 'DESC']],
      include: includeDriver,
    });

    // Priority 2: next upcoming scheduled
    if (!booking) {
      booking = await db.Booking.findOne({
        where: {
          user_id: { [Op.eq]: userId },
          status: { [Op.in]: ['confirmed', 'assigned'] },
          schedule_type: 'scheduled',
          scheduled_at: { [Op.gt]: new Date() },
        },
        order: [['scheduled_at', 'ASC']],
        include: includeDriver,
      });
    }

    if (!booking) {
      return res.json({ success: true, message: 'No active booking', data: { booking: null } });
    }

    const plain = booking.get({ plain: true });
    const driver = plain.assigned_driver;
    let driverDetail = null;
    if (driver && driver.id) {
      const ratingMap = await getRatingSummariesByUserIds({ userIds: [Number(driver.id)] });
      const rating = ratingMap.get(Number(driver.id));
      driverDetail = {
        name: driver.name || null,
        phone: driver.phone || null,
        avatar: driver.driver_profile && driver.driver_profile.profile_picture
          ? driver.driver_profile.profile_picture
          : null,
        rating: rating ? formatPublicAvgRating(rating) : null,
      };
    }

    const { pickupAddress, serviceAddress, serviceLocationName, chargeLimit } =
      resolveAddresses(plain);

    // Use the same round-trip driving distance calculation as Service Details
    // so est_radius_miles is consistent across all screens.
    const rawMiles = await resolveEstimatedTravelMiles(plain);
    const estRadiusMiles = rawMiles != null && Number.isFinite(rawMiles) && rawMiles > 0
      ? Number(rawMiles.toFixed(2))
      : null;

    const result = {
      id: plain.id,
      booking_code: plain.booking_code || null,
      service_type: plain.service_type || null,
      status: plain.status || null,
      tracking_status: plain.tracking_status || null,
      scheduled_at: plain.scheduled_at || null,
      schedule_type: plain.schedule_type || null,
      total_price: plain.total_price != null ? Number(plain.total_price) : null,
      driver: driverDetail,
      pickup_address: pickupAddress,
      service_address: serviceAddress,
      service_location_name: serviceLocationName,
      charge_limit: chargeLimit,
      est_radius_miles: estRadiusMiles,
      created_at: plain.created_at || null,
    };

    return res.json({ success: true, message: 'Active booking fetched', data: { booking: result } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCustomerActiveBooking };
