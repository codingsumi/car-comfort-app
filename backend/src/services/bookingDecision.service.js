const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { sendBookingAcceptedNotifications } = require('./bookingNotification.service');
const { notifyCustomerBookingAccepted } = require('./bookingCustomerNotify.service');
const { notifyDriverBookingAssigned } = require('./driverNotify.service');
const { markDriverRejected, clearDriverRejection } = require('../modules/bookings/bookingRejectionCache.service');
const { reDispatchOnDemandToNextProvider } = require('../modules/bookings/onDemandReDispatch.service');
const { haversineMeters } = require('../modules/utils/haversine');
const {
  bookingCoords,
  MAX_SELF_ACCEPT_RADIUS_M,
} = require('../modules/driver/nearbyDriversForBooking.service');
const { creditWalletOnBookingAccept } = require('./providerWallet.service');
const {
  isOnDemandScheduleType,
  isScheduledBookingForReminders,
} = require('../constants/bookingAfterBookingMessages');
const { scheduleOnDemandAcceptTimers, scheduleScheduledPickupTimers } = require('./bookingTimer.service');
const { scheduleBookingNotificationPipeline } = require('../modules/queues/notification.queue');
const { findActiveBookingForDriver } = require('./bookingActive.service');
const { assertDriverLicenseEligible } = require('./driverLicenseCompliance.service');

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

    await assertDriverLicenseEligible({ userId, driverProfile });

    // ── Distance guard: providers > 50 miles must be assigned by admin ────────
    // Fetch driver's stored location and the booking's coordinates.
    // Only enforced when both sides have valid coordinates.
    const driverUser = await db.User.findByPk(userId, { attributes: ['id', 'latitude', 'longitude'] });
    const driverLat = driverUser?.latitude == null ? null : Number(driverUser.latitude);
    const driverLng = driverUser?.longitude == null ? null : Number(driverUser.longitude);
    const hasDriverCoords = driverLat !== null && Number.isFinite(driverLat) &&
      driverLng !== null && Number.isFinite(driverLng);

    if (hasDriverCoords) {
      // Load booking coords without locking (read-only pre-check)
      const bookingForDistance = await db.Booking.findByPk(id, {
        attributes: [
          'id', 'latitude', 'longitude', 'service_latitude', 'service_longitude',
          'service_lat', 'service_lng',
        ],
      });
      if (bookingForDistance) {
        const bCoords = bookingCoords(bookingForDistance.get({ plain: true }));
        if (bCoords) {
          const distMeters = haversineMeters(driverLat, driverLng, bCoords.lat, bCoords.lng);
          if (distMeters > MAX_SELF_ACCEPT_RADIUS_M) {
            throw new HttpError(
              400,
              'This job is outside your 50-mile service radius and requires admin assignment. Contact support to be assigned.',
              { requires_admin_assignment: true }
            );
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const t = await db.sequelize.transaction();
    let booking;
    let walletCredit = null;
    let isNewAssignment = false;
    try {
        booking = await db.Booking.findOne({
            where: { id },
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (!booking) throw new HttpError(404, 'Booking not found');

        // Only paid/confirmed bookings are eligible for driver acceptance.
        const bookingStatus = String(booking.status || '').trim();
        if (!['confirmed', 'assigned'].includes(bookingStatus)) {
            throw new HttpError(
                400,
                bookingStatus === 'pending_payment'
                    ? 'This booking is awaiting customer payment and cannot be accepted yet'
                    : ['cancelled', 'completed', 'failed'].includes(bookingStatus)
                      ? `This booking is no longer available (status: ${bookingStatus})`
                      : `Booking is not eligible for acceptance (status: ${bookingStatus})`
            );
        }

        if (booking.assigned_driver_user_id && Number(booking.assigned_driver_user_id) !== userId) {
            throw new HttpError(409, 'Booking already accepted by another service provider');
        }

        isNewAssignment = !booking.assigned_driver_user_id;

        if (isNewAssignment) {
            const activeBooking = await findActiveBookingForDriver(userId, {
                excludeBookingId: id,
            });
            if (activeBooking) {
                throw new HttpError(
                    409,
                    'You already have an active booking. Complete it before accepting another.'
                );
            }

            await booking.update(
                {
                    assigned_driver_user_id: userId,
                    provider_id: userId,
                    status: 'assigned'
                },
                { transaction: t }
            );

            walletCredit = await creditWalletOnBookingAccept({
                providerId: userId,
                booking,
                transaction: t
            });
        }

        await t.commit();
    } catch (e) {
        await t.rollback();
        throw e;
    }

    // Best-effort: keep reject state out of DB and in Redis only.
    clearDriverRejection({ bookingId: id, driverUserId: userId }).catch((err) => {
      logger.warn('clearDriverRejection_failed', {
        bookingId: id,
        driverUserId: userId,
        message: err?.message,
        stack: err?.stack
      });
    });

    const acceptedBookingId = booking.id;
    const acceptingDriverUserId = userId;
    const shouldScheduleAcceptTimer = isNewAssignment;
    // Capture the accept timestamp immediately after commit — before any slow
    // async side-effects (emails, SMS, push) that inflate the anchor by 2+ min.
    const acceptedAt = new Date();

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
        const freshBooking = await db.Booking.findByPk(acceptedBookingId);
        if (freshBooking && shouldScheduleAcceptTimer) {
          const freshPlain = freshBooking.get({ plain: true });
          if (isOnDemandScheduleType(freshPlain.schedule_type)) {
            await scheduleOnDemandAcceptTimers(acceptedBookingId, acceptedAt);
          }
          if (isScheduledBookingForReminders(freshPlain)) {
            const reminderResult = await scheduleBookingNotificationPipeline(freshPlain);
            await scheduleScheduledPickupTimers(acceptedBookingId).catch((err) => {
              logger.error('schedule_scheduled_pickup_timers_failed', {
                bookingId: acceptedBookingId,
                message: err?.message,
              });
            });
            logger.info('booking_accept_scheduled_reminders', {
              bookingId: acceptedBookingId,
              driverUserId: acceptingDriverUserId,
              ...reminderResult,
            });
          }
        }
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

    const plain = booking.get({ plain: true });
    if (walletCredit) {
      plain.wallet_credit = {
        credited: walletCredit.credited,
        amount: walletCredit.amount,
        reason: walletCredit.reason,
        wallet: walletCredit.wallet
      };
    }
    return plain;
}

async function rejectBookingAsDriver({ bookingId, auth }) {
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

    const t = await db.sequelize.transaction();
    let booking;
    try {
        booking = await db.Booking.findOne({
            where: { id },
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (!booking) throw new HttpError(404, 'Booking not found');

        // Only paid/confirmed bookings are eligible for driver rejection.
        if (!['confirmed', 'assigned'].includes(String(booking.status))) {
            throw new HttpError(400, 'Booking is not eligible for rejection');
        }

        if (booking.assigned_driver_user_id && Number(booking.assigned_driver_user_id) === userId) {
            throw new HttpError(409, 'Assigned service provider cannot reject this booking');
        }

        if (booking.assigned_driver_user_id && Number(booking.assigned_driver_user_id) !== userId) {
            throw new HttpError(409, 'Booking already accepted by another service provider');
        }

        await t.commit();
    } catch (e) {
        await t.rollback();
        throw e;
    }

    // Best-effort: socket availability filtering uses Redis rejection set.
    markDriverRejected({ bookingId: id, driverUserId: userId }).catch((err) => {
      logger.warn('markDriverRejected_failed', {
        bookingId: id,
        driverUserId: userId,
        message: err?.message,
        stack: err?.stack
      });
    });

    // For on-demand / asap bookings: offer the job to the next eligible provider
    // within the 0-10 mile zone after this rejection. This is best-effort and
    // does not affect the booking status — it stays on the job board for all.
    const scheduleType = String(booking.schedule_type || '').trim().toLowerCase();
    const isOnDemand = scheduleType === 'on_demand' || scheduleType === 'asap';
    if (isOnDemand) {
      reDispatchOnDemandToNextProvider({
        bookingId: id,
        excludeDriverUserId: userId,
      }).catch((err) => {
        logger.warn('on_demand_redispatch_after_rejection_failed', {
          bookingId: id,
          driverUserId: userId,
          message: err?.message,
        });
      });
    }

    return booking.get({ plain: true });
}

module.exports = { acceptBookingAsDriver, rejectBookingAsDriver };

