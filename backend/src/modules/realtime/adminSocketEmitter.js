'use strict';

const { getIoEmitter } = require('./locationPublisher');
const { logger } = require('../../config/logger');

const ADMIN_ROOM = 'admin_panel';

function adminRoom() {
  return ADMIN_ROOM;
}

function emitAdminEvent(eventName, payload) {
  try {
    getIoEmitter().of('/').to(ADMIN_ROOM).emit(String(eventName), payload);
    logger.debug('admin_event_emitted', { eventName, room: ADMIN_ROOM });
    return { emitted: true };
  } catch (err) {
    logger.warn('admin_event_emit_failed', { eventName, message: err?.message });
    return { emitted: false, reason: err?.message };
  }
}

module.exports = { adminRoom, emitAdminEvent, ADMIN_ROOM };
