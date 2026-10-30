const { getIoEmitter } = require('./locationPublisher');
const { logger } = require('../../config/logger');
const { filterDriversNotRejectedForBooking } = require('../bookings/bookingRejectionCache.service');

function driverRoom(driverUserId) {
  return `driver_${Number(driverUserId)}`;
}

/** Room that every approved online driver joins — used for global new-booking broadcasts. */
const ALL_DRIVERS_ROOM = 'all_approved_drivers';

/**
 * Emit to a driver's personal room (joined on socket connect).
 */
function emitToDriver(driverUserId, eventName, payload) {
  const id = Number(driverUserId);
  if (!id) {
    logger.warn('driver_emit_skipped_no_id', { eventName });
    return { emitted: false, reason: 'no_driver_id' };
  }
  const room = driverRoom(id);
  try {
    getIoEmitter().of('/').to(room).emit(String(eventName), payload);
    logger.info('driver_room_emit', { driverUserId: id, room, eventName });
    return { emitted: true, room, eventName };
  } catch (err) {
    logger.error('driver_room_emit_failed', {
      driverUserId: id,
      room,
      eventName,
      message: err?.message,
    });
    return { emitted: false, reason: err?.message || 'emit_error' };
  }
}

/**
 * Fan-out new booking to driver rooms (Redis adapter / multi-instance safe).
 */
async function emitNewBookingAvailableToDrivers(driverUserIds, payload) {
  const io = getIoEmitter();
  const ids = Array.from(new Set((driverUserIds || []).map((n) => Number(n)).filter((n) => n > 0)));
  if (!ids.length) return { emitted: 0, skipped: 0 };

  let eligibleIds = ids;
  const bookingId = Number(payload?.booking_id);
  if (bookingId > 0) {
    eligibleIds = await filterDriversNotRejectedForBooking({ bookingId, driverUserIds: ids });
  }

  const eligibleSet = new Set(eligibleIds);
  let emitted = 0;
  for (const id of ids) {
    if (!eligibleSet.has(id)) continue;
    try {
      io.of('/').to(driverRoom(id)).emit('new_booking_available', payload);
      emitted += 1;
    } catch (err) {
      logger.warn('new_booking_available emit failed', { driverUserId: id, message: err?.message });
    }
  }
  return { emitted, skipped: ids.length - emitted };
}

/**
 * Broadcast a new booking to ALL currently-connected approved drivers via the
 * shared room. This is used as a fallback when no nearby drivers are found.
 */
function emitNewBookingToAllDrivers(payload) {
  try {
    getIoEmitter().of('/').to(ALL_DRIVERS_ROOM).emit('new_booking_available', payload);
    logger.info('new_booking_broadcast_all_drivers', { bookingId: payload?.booking_id });
    return { emitted: true };
  } catch (err) {
    logger.error('new_booking_broadcast_all_drivers_failed', { message: err?.message });
    return { emitted: false };
  }
}

module.exports = { emitNewBookingAvailableToDrivers, emitNewBookingToAllDrivers, emitToDriver, driverRoom, ALL_DRIVERS_ROOM };
