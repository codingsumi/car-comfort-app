const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const db = require('../../models');
const { logger } = require('../../config/logger');
const { loadRealtimeConfig } = require('../configs/realtime.config');
const { getAdapterPubSub } = require('./redisClients');
const { roomName } = require('./locationPublisher');
const { driverRoom } = require('./newBookingSocketEmitter');
const { customerRoom } = require('./customerSocketEmitter');
const { ADMIN_ROOM } = require('./adminSocketEmitter');
const { ingestDriverLocation } = require('../driver/locationIngest.service');

let _io;

function getTokenFromHandshake(handshake) {
  const authToken = handshake.auth && handshake.auth.token;
  if (authToken && String(authToken).trim()) return String(authToken).trim();
  const header = handshake.headers?.authorization || '';
  const [scheme, token] = String(header).split(' ');
  if (scheme === 'Bearer' && token) return token.trim();
  return null;
}

async function attachSocketAuth(socket, next) {
  try {
    const token = getTokenFromHandshake(socket.handshake);
    if (!token) {
      return next(new Error('Unauthorized'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('Server misconfiguration'));
    }

    const payload = jwt.verify(token, secret);
    if (!payload?.userId || !payload?.role) {
      return next(new Error('Unauthorized'));
    }

    const user = await db.User.findByPk(payload.userId);
    if (!user) {
      return next(new Error('Unauthorized'));
    }

    const payloadTokenVersion = Number(payload.tokenVersion || 0);
    const userTokenVersion = Number(user.token_version || 0);
    if (payloadTokenVersion !== userTokenVersion) {
      return next(new Error('Unauthorized'));
    }

    socket.data.auth = {
      userId: Number(payload.userId),
      role: String(payload.role)
    };
    return next();
  } catch (err) {
    logger.debug('Socket auth failed', { message: err?.message });
    return next(new Error('Unauthorized'));
  }
}

function assertCanJoinBooking({ booking, userId, role }) {
  const uid = Number(userId);
  const customerId = Number(booking.customer_id || booking.user_id || 0);
  const providerId = Number(booking.provider_id || booking.assigned_driver_user_id || 0);

  if (String(role) === 'customer' && customerId && customerId === uid) {
    return true;
  }
  if (String(role) === 'driver' && providerId && providerId === uid) {
    return true;
  }
  return false;
}

function attachRealtimeServer(httpServer) {
  const cfg = loadRealtimeConfig();

  const io = new Server(httpServer, {
    path: cfg.socketPath,
    cors: {
      origin: cfg.corsOrigin === '*' ? '*' : cfg.corsOrigin.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  const { pubClient, subClient } = getAdapterPubSub();
  io.adapter(createAdapter(pubClient, subClient));

  io.use(attachSocketAuth);

  io.on('connection', (socket) => {
    const { userId, role } = socket.data.auth || {};
    if (userId && String(role) === 'driver') {
      const dr = driverRoom(userId);
      socket.join(dr);
      // Also join the global broadcast room so new bookings reach every online driver.
      socket.join('all_approved_drivers');
      logger.debug('Socket joined driver room', { userId, room: dr });
    }
    if (userId && String(role) === 'customer') {
      const cr = customerRoom(userId);
      socket.join(cr);
      logger.debug('Socket joined customer room', { userId, room: cr });
    }
    if (userId && String(role) === 'admin') {
      socket.join(ADMIN_ROOM);
      logger.debug('Socket joined admin room', { userId, room: ADMIN_ROOM });
    }

    socket.on('driver_location', async (body) => {
      try {
        await ingestDriverLocation({ ...body, auth: socket.data.auth });
      } catch (err) {
        logger.warn('driver_location_socket_failed', { message: err?.message });
      }
    });

    socket.on('join_booking', async (body, ack) => {
      const reply = (payload) => {
        if (typeof ack === 'function') {
          try {
            ack(payload);
          } catch (_) {
            /* ignore */
          }
        }
      };

      try {
        const bookingId = Number(body?.booking_id ?? body?.bookingId);
        if (!bookingId || bookingId < 1) {
          return reply({ ok: false, error: 'invalid_booking_id' });
        }

        const booking = await db.Booking.findByPk(bookingId);
        if (!booking) {
          return reply({ ok: false, error: 'not_found' });
        }

        if (['draft', 'pending_payment', 'cancelled'].includes(String(booking.status))) {
          return reply({ ok: false, error: 'booking_not_available' });
        }

        const { userId, role } = socket.data.auth || {};
        if (!assertCanJoinBooking({ booking, userId, role })) {
          return reply({ ok: false, error: 'forbidden' });
        }

        const rname = roomName(bookingId);
        await socket.join(rname);
        logger.debug('Socket joined booking room', { userId, bookingId, room: rname });
        return reply({ ok: true, room: rname });
      } catch (err) {
        logger.error('join_booking failed', { message: err?.message });
        return reply({ ok: false, error: 'server_error' });
      }
    });
  });

  _io = io;
  logger.info('Socket.IO attached with Redis adapter', { path: cfg.socketPath });
  return io;
}

function getSocketIO() {
  return _io;
}

module.exports = { attachRealtimeServer, getSocketIO };
