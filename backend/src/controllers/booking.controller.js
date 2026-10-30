const db = require('../models');
const { createBooking, listBookings, updateBookingStatus } = require('../services/booking.service');
const { emitAdminEvent } = require('../modules/realtime/adminSocketEmitter');
const { listBookings: listBookingsV2 } = require('../services/bookingListing.service');
const {
  getActiveBookingForCustomer,
  getActiveBookingForDriver,
} = require('../services/bookingActive.service');
const { getBookingDetail, downloadBookingInvoicePdf } = require('../services/bookingDetail.service');
const {
  cancelBookingAsCustomer,
  cancelBookingAsDriver,
} = require('../services/bookingCancellation.service');
const { sendBookingCancelledEmail } = require('../services/bookingNotification.service');
// const { acceptBookingAsDriver } = require('../services/bookingAcceptance.service');
const { acceptBookingAsDriver, rejectBookingAsDriver } = require('../services/bookingDecision.service');

async function create(req, res, next) {
  try {
    const userId = req.auth?.userId || null;
    const row = await createBooking({ authUserId: userId, body: req.body });
    try {
      emitAdminEvent('booking_created', {
        id: row?.id,
        booking_code: row?.booking_code ?? null,
        status: row?.status ?? null,
        service_type: row?.service_type ?? null,
        user_id: row?.user_id ?? null,
        created_at: row?.created_at ?? new Date().toISOString(),
      });
    } catch (_) {}
    return res.success('Booking created', row);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const auth = req.auth || {};
    const data = await listBookingsV2({ auth, query: req.query });
    return res.success('Bookings fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function getActive(req, res, next) {
  try {
    const auth = req.auth || {};
    const role = String(auth.role || '').trim();
    const data =
      role === 'driver'
        ? await getActiveBookingForDriver({ auth })
        : await getActiveBookingForCustomer({ auth });
    return res.success('Active booking fetched', data);
  } catch (err) {
    return next(err);
  }
}

async function patchStatus(req, res, next) {
  try {
    const userId = req.auth?.userId || null;
    const row = await updateBookingStatus({ bookingId: req.params.id, status: req.body.status, authUserId: userId });
    return res.success('Booking status updated', row);
  } catch (err) {
    return next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const role = String(req.auth?.role || '').trim();
    if (!userId) return res.fail('Unauthorized', 401);

    const reason = req.body?.reason ? String(req.body.reason) : null;
    let data;

    if (role === 'customer') {
      data = await cancelBookingAsCustomer({ bookingId: req.params.id, userId, reason });
      sendBookingCancelledEmail({ bookingId: data.booking_id, userId, cancellation: data }).catch(() => {});
    } else if (role === 'driver') {
      data = await cancelBookingAsDriver({ bookingId: req.params.id, driverUserId: userId, reason });
    } else {
      return res.fail('Forbidden', 403);
    }

    return res.success('Booking cancelled', data);
  } catch (err) {
    return next(err);
  }
}

async function accept(req, res, next) {
  try {
    const auth = req.auth || {};
    const row = await acceptBookingAsDriver({ bookingId: req.params.id, auth });
    return res.success('Booking accepted', row);
  } catch (err) {
    return next(err);
  }
}

async function reject(req, res, next) {
  try {
    const auth = req.auth || {};
    const row = await rejectBookingAsDriver({ bookingId: req.params.id, auth });
    return res.success('Booking rejected', row);
  } catch (err) {
    return next(err);
  }
}

async function downloadInvoice(req, res, next) {
  try {
    const auth = req.auth || {};
    const { buffer, filename } = await downloadBookingInvoicePdf({
      id: req.params.id,
      auth,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

async function raiseDispute(req, res, next) {
  try {
    const auth = req.auth || {};
    const userId = auth.userId || null;
    const role = String(auth.role || '').trim();
    if (!userId || role !== 'customer') return res.fail('Forbidden', 403);

    const bookingId = parseInt(req.params.id, 10);
    if (!bookingId || bookingId <= 0) return res.fail('Invalid booking id', 400);

    const complaint = String(req.body?.complaint || '').trim();
    if (!complaint) return res.fail('complaint is required', 400);
    if (complaint.length > 1000) return res.fail('complaint must be 1000 chars or less', 400);

    const booking = await db.Booking.findOne({ where: { id: bookingId, user_id: userId } });
    if (!booking) return res.fail('Booking not found', 404);

    const allowedStatuses = ['completed', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.fail(`Disputes can only be raised on completed or in-progress bookings (current: ${booking.status})`, 400);
    }

    const existingDispute = await db.BookingDispute.findOne({
      where: { booking_id: bookingId, status: ['open', 'investigating'] },
    });
    if (existingDispute) return res.fail('An open dispute already exists for this booking', 409);

    const dispute = await db.BookingDispute.create({
      booking_id: bookingId,
      customer_complaint: complaint,
      status: 'open',
    });

    booking.dispute_status = 'open';
    await booking.save();

    try {
      await db.BookingTimeline.create({
        booking_id: bookingId,
        event_type: 'dispute_opened',
        message: 'Customer raised a dispute',
        actor_type: 'customer',
        actor_id: userId,
        metadata: { dispute_id: dispute.id },
      });
    } catch (_) {}

    try {
      const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');
      emitToCustomer(userId, 'dispute_opened', {
        booking_id: bookingId,
        dispute_id: dispute.id,
        dispute_status: 'open',
        message: 'Your dispute has been submitted and is under review.',
      });
    } catch (_) {}

    try {
      const { emitAdminEvent } = require('../modules/realtime/adminSocketEmitter');
      emitAdminEvent('booking_updated', {
        booking_id: bookingId,
        dispute_status: 'open',
        dispute_id: dispute.id,
        event: 'customer_dispute_raised',
      });
    } catch (_) {}

    return res.success('Dispute raised successfully', dispute);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  list,
  getActive,
  downloadInvoice,
  raiseDispute,
  getById: async function getById(req, res, next) {
    try {
      const auth = req.auth || {};
      const row = await getBookingDetail({ id: req.params.id, auth, req });
      return res.success('Booking fetched', row);
    } catch (err) {
      return next(err);
    }
  },
  patchStatus,
  cancel,
  accept,
  reject
};

