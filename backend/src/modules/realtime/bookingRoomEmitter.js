'use strict';

const { getIoEmitter } = require('./locationPublisher');
const { logger } = require('../../config/logger');

function bookingRoom(bookingId) {
  return `booking_${Number(bookingId)}`;
}

/**
 * Emit to all sockets in the booking's tracking room (Redis emitter / multi-instance).
 */
function emitToBookingRoom(bookingId, eventName, payload) {
  const bid = Number(bookingId);
  if (!bid) {
    logger.warn('booking_room_emit_skipped_no_id', { eventName });
    return { emitted: false, reason: 'no_booking_id' };
  }
  const room = bookingRoom(bid);
  try {
    getIoEmitter().of('/').to(room).emit(String(eventName), payload);
    logger.info('booking_room_emit', { bookingId: bid, room, eventName });
    return { emitted: true, room, eventName };
  } catch (err) {
    logger.error('booking_room_emit_failed', {
      bookingId: bid,
      room,
      eventName,
      message: err?.message,
      stack: err?.stack
    });
    return { emitted: false, reason: err?.message || 'emit_error' };
  }
}

module.exports = { bookingRoom, emitToBookingRoom };
