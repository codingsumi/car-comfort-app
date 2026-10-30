const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { sendBookingAcceptedNotifications } = require('./bookingNotification.service');
const { notifyCustomerBookingAccepted } = require('./bookingCustomerNotify.service');
const { notifyDriverBookingAssigned } = require('./driverNotify.service');
const { validateDailyLimit } = require('./serviceLimit.service');

function parseId(v, name) {
  const n = Number.parseInt(String(v), 10);
  if (!n || n < 1) throw new HttpError(400, `${name} must be a positive integer`);
  return n;
}

async function acceptBookingAsDriver({ bookingId, auth }) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');

  const id = parseId(bookingId, 'bookingId');

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');
  if (driverProfile.approval_status && driverProfile.approval_status !== 'approved') {
    throw new HttpError(403, 'Service provider not approved');
  }

  const limitCheck = await validateDailyLimit(userId);
  if (!limitCheck.allowed) {
    throw new HttpError(403, limitCheck.reason || 'Daily service limit reached');
  }

  const t = await db.sequelize.transaction();
  let booking;
  try {
    booking = await db.Booking.findOne({
      where: { id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!booking) throw new HttpError(404, 'Booking not found');

    // Only paid/confirmed bookings are eligible for driver acceptance.
    if (!['confirmed', 'assigned'].includes(String(booking.status))) {
      throw new HttpError(400, 'Booking is not eligible for acceptance');
    }

    if (booking.assigned_driver_user_id && Number(booking.assigned_driver_user_id) !== userId) {
      throw new HttpError(409, 'Booking already accepted by another service provider');
    }

    if (!booking.assigned_driver_user_id) {
      await booking.update(
        {
          assigned_driver_user_id: userId,
          status: 'assigned'
        },
        { transaction: t }
      );
    }

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }

  const acceptedBookingId = booking.id;
  const acceptingDriverUserId = userId;

  void (async () => {
    try {
      logger.info('booking_accept_side_effects_start', {
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId
      });
      await sendBookingAcceptedNotifications({ bookingId: acceptedBookingId });
      logger.info('booking_accept_email_sms_done', {
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId
      });
      await notifyCustomerBookingAccepted({
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId
      });
      await notifyDriverBookingAssigned({
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId,
      });
      logger.info('booking_accept_customer_push_socket_done', {
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId
      });
    } catch (err) {
      logger.error('booking_accept_side_effects_failed', {
        bookingId: acceptedBookingId,
        driverUserId: acceptingDriverUserId,
        message: err?.message,
        stack: err?.stack
      });
    }
  })();

  return booking.get({ plain: true });
}

module.exports = { acceptBookingAsDriver };

