'use strict';

/**
 * adminBookingNotify.service.js
 *
 * Standardized notifications fired by admin actions on bookings:
 *  - Booking edit (schedule / address / provider / notes changes)
 *  - Refund processed
 *  - Dispute opened / resolved
 *  - Booking status changed by admin
 *
 * Every function is best-effort: errors are logged but never thrown
 * so the admin action itself never fails due to a notification issue.
 */

const db = require('../models');
const { logger } = require('../config/logger');
const { sendEmail } = require('./email.service');
const { sendSms } = require('./sms.service');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { isOneSignalConfigured } = require('../config/onesignal');
const { emitToCustomer } = require('../modules/realtime/customerSocketEmitter');
const { emitToDriver } = require('../modules/realtime/newBookingSocketEmitter');
const { generateEmailTemplate } = require('../../utils/emailTemplate');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bookingIdDisplay(booking) {
  if (!booking) return '';
  return booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
}

function serviceTypeLabel(serviceType) {
  switch (serviceType) {
    case 'car_wash': return 'Car Wash';
    case 'ev_charging': return 'EV Charging';
    case 'combo': return 'EV Charging + Car Wash';
    default: return 'Service';
  }
}

function formatDate(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }) + ' UTC';
  } catch {
    return String(date);
  }
}

function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function isAdminBookingNotificationEnabled() {
  return String(process.env.ADMIN_BOOKING_NOTIFICATION_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function getAdminBookingNotificationRecipient() {
  return String(process.env.ADMIN_BOOKING_NOTIFICATION_EMAIL || 'info@carcomfort-llc.com').trim();
}

function displayUserName(user) {
  if (!user) return 'Customer';
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || String(user.name || '').trim() || 'Customer';
}

async function loadUser(userId) {
  if (!userId) return null;
  try {
    return await db.User.findByPk(userId, {
      attributes: ['id', 'name', 'first_name', 'last_name', 'email', 'phone'],
    });
  } catch { return null; }
}

async function loadBookingWithRelations(bookingId) {
  try {
    return await db.Booking.findByPk(bookingId, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'name', 'first_name', 'last_name', 'email', 'phone'] },
        { model: db.User, as: 'assigned_driver', attributes: ['id', 'name', 'first_name', 'last_name', 'email', 'phone'] },
      ],
    });
  } catch { return null; }
}

async function safeSendEmail({ to, subject, text, html }) {
  if (!to) return { skipped: true, reason: 'no_email' };
  try {
    return await sendEmail({ to, subject, text, html });
  } catch (err) {
    logger.warn('admin_notify_email_failed', { to, subject, message: err?.message });
    return { failed: true };
  }
}

async function safeSendSms({ to, text }) {
  if (!to) return { skipped: true, reason: 'no_phone' };
  try {
    return await sendSms({ to, text });
  } catch (err) {
    logger.warn('admin_notify_sms_failed', { to, message: err?.message });
    return { failed: true };
  }
}

async function safeSendPush(userId, { title, body, data }) {
  if (!userId || !isOneSignalConfigured()) return { skipped: true };
  try {
    return await sendPushToUser(userId, {
      title,
      body,
      data: data || {},
      idempotencyKey: data?.idempotencyKey || null,
    });
  } catch (err) {
    logger.warn('admin_notify_push_failed', { userId, title, message: err?.message });
    return { failed: true };
  }
}

// ─── NEW BOOKING ADMIN NOTIFICATION ─────────────────────────────────────────

/**
 * Email operations when a customer has completed payment for a new booking.
 * This is best-effort so an SMTP outage cannot affect a confirmed booking.
 */
async function notifyAdminNewBooking({ booking }) {
  const bookingId = Number(booking?.id);
  if (!bookingId) return { skipped: true, reason: 'invalid_booking' };
  if (!isAdminBookingNotificationEnabled()) return { skipped: true, reason: 'disabled' };

  const to = getAdminBookingNotificationRecipient();
  if (!to) return { skipped: true, reason: 'no_recipient' };

  try {
    const customer = await loadUser(booking.user_id || booking.customer_id);
    const bookingDisplay = bookingIdDisplay(booking);
    const service = serviceTypeLabel(booking.service_type);
    const schedule = booking.schedule_type === 'scheduled' && booking.scheduled_at
      ? formatDate(booking.scheduled_at)
      : 'On-demand (as soon as possible)';
    const address = booking.service_address || booking.address || 'Not provided';
    const total = formatMoney(booking.total_price);

    const details = [
      `Booking: ${bookingDisplay}`,
      `Service: ${service}`,
      `Schedule: ${schedule}`,
      `Customer: ${displayUserName(customer)}`,
      customer?.phone ? `Customer phone: ${customer.phone}` : null,
      customer?.email ? `Customer email: ${customer.email}` : null,
      `Location: ${address}`,
      total ? `Total: ${total}` : null,
      '',
      'Please review the booking in the admin panel and contact an available service provider.',
    ].filter(Boolean).join('\n');
    const subject = `[Car Comfort] New booking ${bookingDisplay} needs a provider`;
    const html = generateEmailTemplate({
      title: 'New Booking Received',
      message: details,
      footer: 'This is an operations alert from Car Comfort.',
      preheader: `New ${service} booking ${bookingDisplay} requires provider outreach.`,
    });

    const result = await safeSendEmail({ to, subject, text: details, html });
    if (result?.failed) {
      logger.warn('admin_new_booking_email_delivery_failed', { bookingId, to });
      return { failed: true, reason: 'send_failed' };
    }
    logger.info('admin_new_booking_email_sent', { bookingId, to, mocked: result?.mocked === true });
    return { ok: true, result };
  } catch (err) {
    logger.warn('admin_new_booking_email_failed', { bookingId, to, message: err?.message });
    return { failed: true, reason: err?.message || 'send_failed' };
  }
}

// ─── BOOKING EDIT NOTIFICATIONS ───────────────────────────────────────────────

/**
 * Notify customer + provider when admin edits booking details.
 *
 * @param {object} opts
 * @param {number|string} opts.bookingId
 * @param {object} opts.booking         - booking plain object (optional, loaded if omitted)
 * @param {object} opts.changes         - { scheduled_at, service_address, provider_changed, notes_changed }
 * @param {object} [opts.newProvider]   - User object for newly assigned provider
 * @param {object} [opts.oldProvider]   - User object for previously assigned provider (if changed)
 */
async function notifyBookingEdited({ bookingId, booking: bookingArg, changes = {}, newProvider, oldProvider }) {
  try {
    const b = bookingArg || await loadBookingWithRelations(bookingId);
    if (!b) return { skipped: true, reason: 'missing_booking' };

    const bid = bookingIdDisplay(b);
    const svcLabel = serviceTypeLabel(b.service_type);
    const customerUserId = b.user_id || b.customer_id;
    const customer = b.user || await loadUser(customerUserId);

    const changeLines = [];
    if (changes.scheduled_at) changeLines.push(`New schedule: ${formatDate(changes.scheduled_at)}`);
    if (changes.service_address) changeLines.push(`New service address: ${changes.service_address}`);
    if (changes.provider_changed) changeLines.push('Your service provider has been updated.');

    // ── Customer notifications ──────────────────────────────────────────────
    if (customer && changeLines.length > 0) {
      const subject = `Your booking has been updated ${bid}`;
      const message = [
        `Your ${svcLabel} booking ${bid} has been updated by our team.`,
        '',
        ...changeLines,
        '',
        'If you have any questions, please contact us at info@carcomfort-llc.com or call 1-800-702-3590.',
      ].join('\n');

      const smsText = `Car Comfort: Your booking ${bid} has been updated. ${changeLines.join(' ')} Questions? Call 1-800-702-3590.`;

      if (customer.email) {
        const html = generateEmailTemplate({
          title: 'Booking Updated',
          message,
          footer: 'Thank you for choosing Car Comfort.',
          preheader: `Your booking ${bid} has been updated.`,
        });
        await safeSendEmail({ to: customer.email, subject, text: message, html });
      }

      if (customer.phone) {
        await safeSendSms({ to: customer.phone, text: smsText });
      }

      // Push
      await safeSendPush(customerUserId, {
        title: `Booking updated ${bid}`,
        body: changeLines[0] || 'Your booking details have been updated.',
        data: { booking_id: String(bookingId), type: 'booking_edited', idempotencyKey: `booking_edited:${bookingId}:${Date.now()}` },
      });

      // Socket
      emitToCustomer(customerUserId, 'booking_updated', {
        booking_id: Number(bookingId),
        changes,
        message: `Your booking ${bid} has been updated.`,
      });
    }

    // ── New provider notification ───────────────────────────────────────────
    if (changes.provider_changed && newProvider) {
      const providerMsg = `You have been assigned to booking ${bid} (${svcLabel}).${changes.scheduled_at ? ` Schedule: ${formatDate(changes.scheduled_at)}` : ''}${changes.service_address ? ` Address: ${changes.service_address}` : ''}`;

      if (newProvider.email) {
        const html = generateEmailTemplate({
          title: `New Booking Assignment ${bid}`,
          message: providerMsg,
          footer: 'Car Comfort Provider Network',
          preheader: `You've been assigned to booking ${bid}.`,
        });
        await safeSendEmail({ to: newProvider.email, subject: `New booking assignment ${bid}`, text: providerMsg, html });
      }

      await safeSendPush(newProvider.id, {
        title: `Booking assigned ${bid}`,
        body: `You've been assigned to a ${svcLabel} service.`,
        data: { booking_id: String(bookingId), type: 'booking_assigned', idempotencyKey: `booking_assigned:${bookingId}:${Date.now()}` },
      });

      emitToDriver(newProvider.id, 'booking_assigned', {
        booking_id: Number(bookingId),
        message: `You have been assigned to booking ${bid}.`,
      });
    }

    // ── Old provider unassignment notification ─────────────────────────────
    if (changes.provider_changed && oldProvider) {
      const unassignMsg = `You have been unassigned from booking ${bid} (${svcLabel}).`;

      if (oldProvider.email) {
        const html = generateEmailTemplate({
          title: `Booking Unassignment ${bid}`,
          message: unassignMsg,
          footer: 'Car Comfort Provider Network',
          preheader: unassignMsg,
        });
        await safeSendEmail({ to: oldProvider.email, subject: `Booking unassignment ${bid}`, text: unassignMsg, html });
      }

      await safeSendPush(oldProvider.id, {
        title: `Booking unassigned ${bid}`,
        body: unassignMsg,
        data: { booking_id: String(bookingId), type: 'booking_unassigned' },
      });

      emitToDriver(oldProvider.id, 'booking_unassigned', {
        booking_id: Number(bookingId),
        message: unassignMsg,
      });
    }

    return { notified: true };
  } catch (err) {
    logger.error('admin_notify_booking_edited_failed', { bookingId, message: err?.message, stack: err?.stack });
    return { failed: true, reason: err?.message };
  }
}

// ─── REFUND NOTIFICATIONS ─────────────────────────────────────────────────────

/**
 * Notify customer when admin processes a refund.
 */
async function notifyRefundProcessed({ bookingId, booking: bookingArg, amount, reason }) {
  try {
    const b = bookingArg || await loadBookingWithRelations(bookingId);
    if (!b) return { skipped: true, reason: 'missing_booking' };

    const bid = bookingIdDisplay(b);
    const svcLabel = serviceTypeLabel(b.service_type);
    const customerUserId = b.user_id || b.customer_id;
    const customer = b.user || await loadUser(customerUserId);
    if (!customer) return { skipped: true, reason: 'missing_customer' };

    const amountDisplay = formatMoney(amount) || `$${amount}`;
    const subject = `Refund processed for your booking ${bid}`;
    const message = [
      `A refund of ${amountDisplay} has been processed for your ${svcLabel} booking ${bid}.`,
      '',
      reason ? `Reason: ${reason}` : null,
      '',
      'Refunds typically appear on your statement within 5–10 business days depending on your bank.',
      'If you have questions, contact us at info@carcomfort-llc.com or call 1-800-702-3590.',
    ].filter((l) => l !== null).join('\n');

    const smsText = `Car Comfort: A refund of ${amountDisplay} has been issued for booking ${bid}. It may take 5-10 business days. Questions? 1-800-702-3590.`;

    if (customer.email) {
      const html = generateEmailTemplate({
        title: 'Refund Processed',
        message,
        footer: 'Thank you for choosing Car Comfort.',
        preheader: `Refund of ${amountDisplay} processed for ${bid}.`,
      });
      await safeSendEmail({ to: customer.email, subject, text: message, html });
    }

    if (customer.phone) {
      await safeSendSms({ to: customer.phone, text: smsText });
    }

    // Push
    await safeSendPush(customerUserId, {
      title: `Refund processed ${bid}`,
      body: `${amountDisplay} refund has been issued for your booking.`,
      data: { booking_id: String(bookingId), type: 'refund_processed', idempotencyKey: `refund_processed:${bookingId}:${Date.now()}` },
    });

    // Socket to customer
    emitToCustomer(customerUserId, 'refund_processed', {
      booking_id: Number(bookingId),
      amount: Number(amount),
      message: `A refund of ${amountDisplay} has been processed for your booking ${bid}.`,
    });

    return { notified: true };
  } catch (err) {
    logger.error('admin_notify_refund_failed', { bookingId, message: err?.message });
    return { failed: true, reason: err?.message };
  }
}

// ─── DISPUTE NOTIFICATIONS ────────────────────────────────────────────────────

/**
 * Notify customer (and optionally provider) when a dispute is opened.
 */
async function notifyDisputeOpened({ bookingId, booking: bookingArg, disputeId }) {
  try {
    const b = bookingArg || await loadBookingWithRelations(bookingId);
    if (!b) return { skipped: true, reason: 'missing_booking' };

    const bid = bookingIdDisplay(b);
    const customerUserId = b.user_id || b.customer_id;
    const customer = b.user || await loadUser(customerUserId);

    if (customer) {
      const subject = `A dispute has been opened for booking ${bid}`;
      const message = [
        `Our team has opened a dispute review for your booking ${bid}.`,
        '',
        'We are investigating and will update you as soon as possible.',
        'If you have information to share, please contact us at info@carcomfort-llc.com or call 1-800-702-3590.',
      ].join('\n');

      if (customer.email) {
        const html = generateEmailTemplate({
          title: 'Dispute Opened',
          message,
          footer: 'Thank you for your patience.',
          preheader: `A dispute review has been opened for booking ${bid}.`,
        });
        await safeSendEmail({ to: customer.email, subject, text: message, html });
      }

      await safeSendPush(customerUserId, {
        title: `Dispute opened ${bid}`,
        body: 'Our team has opened a review for your booking.',
        data: { booking_id: String(bookingId), dispute_id: String(disputeId || ''), type: 'dispute_opened' },
      });

      emitToCustomer(customerUserId, 'dispute_opened', {
        booking_id: Number(bookingId),
        dispute_id: disputeId ? Number(disputeId) : null,
        message: `A dispute has been opened for your booking ${bid}.`,
      });
    }

    // Also notify assigned provider
    const providerUserId = b.assigned_driver_user_id;
    if (providerUserId) {
      await safeSendPush(providerUserId, {
        title: `Dispute opened ${bid}`,
        body: `A dispute review has been started for booking ${bid}.`,
        data: { booking_id: String(bookingId), type: 'dispute_opened' },
      });

      emitToDriver(providerUserId, 'dispute_opened', {
        booking_id: Number(bookingId),
        message: `A dispute review has been opened for booking ${bid}.`,
      });
    }

    return { notified: true };
  } catch (err) {
    logger.error('admin_notify_dispute_opened_failed', { bookingId, message: err?.message });
    return { failed: true, reason: err?.message };
  }
}

/**
 * Notify customer when a dispute is resolved/closed.
 */
async function notifyDisputeResolved({ bookingId, booking: bookingArg, disputeStatus, adminNotes }) {
  try {
    const b = bookingArg || await loadBookingWithRelations(bookingId);
    if (!b) return { skipped: true, reason: 'missing_booking' };

    const bid = bookingIdDisplay(b);
    const customerUserId = b.user_id || b.customer_id;
    const customer = b.user || await loadUser(customerUserId);
    if (!customer) return { skipped: true, reason: 'missing_customer' };

    const statusLabel = disputeStatus === 'resolved' ? 'resolved' : 'closed';
    const subject = `Your booking dispute has been ${statusLabel} ${bid}`;
    const message = [
      `The dispute for your booking ${bid} has been ${statusLabel}.`,
      '',
      'If you have further questions, please contact us at info@carcomfort-llc.com or call 1-800-702-3590.',
    ].join('\n');

    if (customer.email) {
      const html = generateEmailTemplate({
        title: `Dispute ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
        message,
        footer: 'Thank you for choosing Car Comfort.',
        preheader: `Your dispute for ${bid} has been ${statusLabel}.`,
      });
      await safeSendEmail({ to: customer.email, subject, text: message, html });
    }

    await safeSendPush(customerUserId, {
      title: `Dispute ${statusLabel} ${bid}`,
      body: `The dispute for your booking has been ${statusLabel}.`,
      data: { booking_id: String(bookingId), type: 'dispute_resolved' },
    });

    emitToCustomer(customerUserId, 'dispute_updated', {
      booking_id: Number(bookingId),
      dispute_status: disputeStatus,
      message: `Your dispute for booking ${bid} has been ${statusLabel}.`,
    });

    return { notified: true };
  } catch (err) {
    logger.error('admin_notify_dispute_resolved_failed', { bookingId, message: err?.message });
    return { failed: true, reason: err?.message };
  }
}

// ─── STATUS CHANGE NOTIFICATIONS ─────────────────────────────────────────────

/**
 * Notify customer and provider when admin changes booking status.
 */
async function notifyBookingStatusChanged({ bookingId, booking: bookingArg, previousStatus, newStatus }) {
  try {
    const b = bookingArg || await loadBookingWithRelations(bookingId);
    if (!b) return { skipped: true, reason: 'missing_booking' };

    const bid = bookingIdDisplay(b);
    const svcLabel = serviceTypeLabel(b.service_type);
    const customerUserId = b.user_id || b.customer_id;
    const customer = b.user || await loadUser(customerUserId);

    const statusDisplayMap = {
      confirmed: 'Confirmed',
      assigned: 'Provider Assigned',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      failed: 'Service Failed',
      disputed: 'Under Dispute Review',
    };

    const statusDisplay = statusDisplayMap[newStatus] || newStatus;

    // Skip push/email for internal-only transitions that already have dedicated flows
    const silentStatuses = new Set(['disputed']); // dispute open already notified separately

    if (!silentStatuses.has(newStatus) && customer) {
      const subject = `Your booking status has been updated ${bid}`;
      const message = [
        `Your ${svcLabel} booking ${bid} status has been updated to: ${statusDisplay}.`,
        '',
        newStatus === 'completed'
          ? 'Thank you for using Car Comfort! We hope you enjoyed the service.'
          : newStatus === 'cancelled'
            ? 'If you have questions about your cancellation, please contact info@carcomfort-llc.com.'
            : 'For questions, contact us at info@carcomfort-llc.com or call 1-800-702-3590.',
      ].join('\n');

      if (customer.email) {
        const html = generateEmailTemplate({
          title: `Booking ${statusDisplay}`,
          message,
          footer: 'Thank you for choosing Car Comfort.',
          preheader: `Booking ${bid} is now ${statusDisplay}.`,
        });
        await safeSendEmail({ to: customer.email, subject, text: message, html });
      }

      await safeSendPush(customerUserId, {
        title: `Booking ${statusDisplay} ${bid}`,
        body: `Your ${svcLabel} booking is now ${statusDisplay}.`,
        data: {
          booking_id: String(bookingId),
          type: 'booking_status_changed',
          status: newStatus,
          idempotencyKey: `status_changed:${bookingId}:${newStatus}`,
        },
      });

      emitToCustomer(customerUserId, 'booking_status_changed', {
        booking_id: Number(bookingId),
        status: newStatus,
        previous_status: previousStatus,
        message: `Your booking ${bid} is now ${statusDisplay}.`,
      });
    }

    // Notify provider (no email — push + socket only)
    const providerUserId = b.assigned_driver_user_id;
    if (providerUserId && !silentStatuses.has(newStatus)) {
      await safeSendPush(providerUserId, {
        title: `Booking updated ${bid}`,
        body: `Booking ${bid} status changed to ${statusDisplay}.`,
        data: {
          booking_id: String(bookingId),
          type: 'booking_status_changed',
          status: newStatus,
          idempotencyKey: `provider_status_changed:${bookingId}:${newStatus}`,
        },
      });

      emitToDriver(providerUserId, 'booking_status_changed', {
        booking_id: Number(bookingId),
        status: newStatus,
        previous_status: previousStatus,
      });
    }

    return { notified: true };
  } catch (err) {
    logger.error('admin_notify_status_changed_failed', { bookingId, message: err?.message });
    return { failed: true, reason: err?.message };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  notifyAdminNewBooking,
  notifyBookingEdited,
  notifyRefundProcessed,
  notifyDisputeOpened,
  notifyDisputeResolved,
  notifyBookingStatusChanged,
};
