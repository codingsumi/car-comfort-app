const { getIoEmitter } = require('./locationPublisher');
const { logger } = require('../../config/logger');

function customerRoom(customerUserId) {
  return `customer_${Number(customerUserId)}`;
}

/**
 * Emit to all sockets in the customer's dedicated room (Redis emitter / multi-instance).
 */
function emitToCustomer(customerUserId, eventName, payload) {
  const cid = Number(customerUserId);
  if (!cid) {
    logger.warn('customer_socket_emit_skipped_no_customer', { eventName });
    return { emitted: false, reason: 'no_customer_id' };
  }
  const room = customerRoom(cid);
  try {
    getIoEmitter().of('/').to(room).emit(String(eventName), payload);
    logger.info('customer_socket_emit', { customerId: cid, room, eventName });
    return { emitted: true, room, eventName };
  } catch (err) {
    logger.error('customer_socket_emit_failed', {
      customerId: cid,
      room,
      eventName,
      message: err?.message,
      stack: err?.stack
    });
    return { emitted: false, reason: err?.message || 'emit_error' };
  }
}

module.exports = { customerRoom, emitToCustomer };
