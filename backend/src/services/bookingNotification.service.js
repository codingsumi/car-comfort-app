const db = require('../models');
const { logger } = require('../config/logger');
const { sendEmail } = require('./email.service');
const { sendSms } = require('./sms.service');
const { generateEmailTemplate } = require('../../utils/emailTemplate');
const { generateBookingInvoicePdf } = require('./invoice.service');
const {
  getCustomerBookingConfirmedMessage,
  getCustomerProviderAssignedMessage
} = require('../constants/bookingAfterBookingMessages');

function getServiceTypeLabel(serviceType) {
  switch (serviceType) {
    case 'car_wash':
      return 'Car Wash';
    case 'ev_charging':
      return 'EV Charging';
    case 'combo':
      return 'EV Charging + Car Wash';
    default:
      return 'Service';
  }
}

function getBookingIdDisplay(booking) {
  if (!booking) return '';
  if (booking.booking_code) return `#${booking.booking_code}`;
  if (booking.id) return `#${booking.id}`;
  return '';
}

function formatMoneyUsd(amountDecimal) {
  const amount = Number(amountDecimal);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const DISCLAIMER =
  'Please ensure your vehicle is in safe operating condition and has sufficient fuel or charge to reach the nearest EV charging station or car wash. We are not responsible if your vehicle cannot reach the service station due to pre-existing conditions or an insufficient charge level. Thank you!';

function formatBookingDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return String(dateStr);
  }
}

function buildBookingDetailsBlock(booking) {
  const lines = [];

  // Booking reference
  const ref = getBookingIdDisplay(booking);
  if (ref) lines.push(`Booking Reference: ${ref}`);

  // Service type
  const svcLabel = getServiceTypeLabel(booking?.service_type);
  lines.push(`Service: ${svcLabel}`);

  // Schedule
  const scheduleType = String(booking?.schedule_type || '').toLowerCase();
  if (scheduleType === 'scheduled' && booking?.scheduled_at) {
    lines.push(`Scheduled Date & Time: ${formatBookingDate(booking.scheduled_at)}`);
  } else if (scheduleType === 'asap' || scheduleType === 'on_demand') {
    lines.push('Schedule: On-demand (as soon as possible)');
  }

  // Label depends on service type: EV charging = "Vehicle Location", others = "Pickup Address"
  const serviceType = String(booking?.service_type || '').trim().toLowerCase();
  const isEvService = serviceType === 'ev_charging' || serviceType === 'combo';
  const addressLabel = isEvService ? 'Vehicle Location' : 'Pickup Address';
  const address = booking?.address || booking?.service_address || null;
  if (address) lines.push(`${addressLabel}: ${address}`);

  // Service location name
  const serviceLoc = booking?.service_location_name || booking?.ev_charging_location_name || null;
  if (serviceLoc) lines.push(`Service Location: ${serviceLoc}`);

  // Total
  const total = Number(booking?.total_price || 0);
  if (total > 0) {
    lines.push(`Total Charged: ${formatMoneyUsd(total)}`);
  }

  return lines.join('\n');
}

function buildBookingConfirmedCopy({ booking, customerName } = {}) {
  const serviceTypeLabel = getServiceTypeLabel(booking?.service_type);
  const bookingIdDisplay = getBookingIdDisplay(booking);
  const docCopy = getCustomerBookingConfirmedMessage(booking?.schedule_type);

  const subject = bookingIdDisplay
    ? `Booking Confirmed ${bookingIdDisplay}`
    : 'Your CarComfort Booking is Confirmed';

  const detailsBlock = buildBookingDetailsBlock(booking);

  // Personalized greeting
  const greeting = customerName ? `Hi ${customerName},` : 'Hi,';

  // Opening line
  const openingBody = docCopy
    ? docCopy.body
    : `Your ${serviceTypeLabel} service has been confirmed${bookingIdDisplay ? ` (${bookingIdDisplay})` : ''}. You will be notified once a service provider has been assigned for your appointment.`;

  // Disclaimer lives in the email footer only — not repeated here
  const messageLines = [
    greeting,
    '',
    openingBody,
    '',
    '— Booking Details —',
    detailsBlock,
  ];

  const message = messageLines.join('\n');

  const sms = [
    `CarComfort: Your ${serviceTypeLabel} booking is confirmed${bookingIdDisplay ? ` (${bookingIdDisplay})` : ''}.`,
    'We will notify you when a service provider is assigned.',
  ].join(' ');

  return { subject, message, sms, bookingIdDisplay, serviceTypeLabel };
}

function buildBookingCancelledCopy({ booking, cancellation }) {
  const serviceTypeLabel = getServiceTypeLabel(booking?.service_type);
  const bookingIdDisplay = getBookingIdDisplay(booking);

  const subject = bookingIdDisplay ? `Booking cancelled ${bookingIdDisplay}` : 'Booking cancelled';

  const scheduleLine =
    booking?.schedule_type === 'scheduled' && booking?.scheduled_at
      ? `Scheduled for: ${new Date(booking.scheduled_at).toLocaleString()}`
      : booking?.schedule_type === 'asap'
        ? 'Schedule: ASAP'
        : booking?.schedule_type === 'on_demand'
          ? 'Schedule: On-demand service'
          : null;

  const lines = [
    `Your booking has been canceled${bookingIdDisplay ? ` (${bookingIdDisplay})` : ''}.`,
    `Service: ${serviceTypeLabel}`,
    ...(scheduleLine ? [scheduleLine] : []),
    ''
  ];

  const cancellationReason =
    (cancellation?.cancellation_reason != null ? String(cancellation.cancellation_reason) : null) ||
    (booking?.cancellation_reason != null ? String(booking.cancellation_reason) : null);
  if (cancellationReason && cancellationReason.trim()) {
    lines.push(`Cancellation reason: ${cancellationReason.trim()}`);
    lines.push('');
  }

  const refundAmount = Number(cancellation?.refund_amount || booking?.refund_amount || 0);
  const paidAmount = Number(cancellation?.paid_amount || 0);
  const fee = Number(cancellation?.cancellation_fee || booking?.cancellation_fee || 0);
  const refundStatus = cancellation?.refund_status || (refundAmount > 0 ? 'processing' : 'none');

  if (refundAmount > 0) {
    const refundDisplay = formatMoneyUsd(refundAmount) || String(refundAmount);
    if (refundStatus === 'refunded') {
      lines.push(`Refund: ${refundDisplay} has been issued to your original payment method.`);
    } else {
      lines.push(`Refund: ${refundDisplay} will be processed shortly to your original payment method.`);
    }
    if (fee > 0) {
      const feeDisplay = formatMoneyUsd(fee) || String(fee);
      lines.push(`Cancellation fee: ${feeDisplay}`);
    }
  } else {
    const policy = cancellation?.policy || null;
    const policyMessage = cancellation?.policy_message || null;

    if (paidAmount <= 0) {
      lines.push('Refund: No payment was captured, so no refund is due.');
    } else if (policy === 'no_refund') {
      lines.push('Refund: Not eligible once the service has started.');
    } else if (policy === 'fee') {
      const feeDisplay = formatMoneyUsd(fee) || String(fee);
      lines.push(`Refund: ${formatMoneyUsd(Math.max(0, paidAmount - fee)) || 0} (a ${feeDisplay} cancellation fee was applied).`);
    } else if (policyMessage) {
      lines.push(`Refund: ${policyMessage}`);
    } else {
      lines.push('Refund: Not available for this cancellation.');
    }
  }

  lines.push('');
  lines.push('We’d love to help you again—book a new service anytime from the app.');

  const message = lines.join('\n');
  const preheader = `Your ${serviceTypeLabel} booking has been canceled${bookingIdDisplay ? ` (${bookingIdDisplay})` : ''}.`;

  return { subject, message, preheader, bookingIdDisplay, serviceTypeLabel };
}

function buildBookingAcceptedCopy({ booking }) {
  const serviceTypeLabel = getServiceTypeLabel(booking?.service_type);
  const bookingIdDisplay = getBookingIdDisplay(booking);
  const assigned = getCustomerProviderAssignedMessage(booking?.schedule_type);

  const subject = bookingIdDisplay
    ? `${assigned.title} ${bookingIdDisplay}`
    : assigned.title;
  const message = assigned.body;
  const sms = assigned.body;

  return { subject, message, sms, bookingIdDisplay, serviceTypeLabel };
}

async function sendBookingAcceptedNotifications({ bookingId, booking, userId, user }) {
  const b = booking || (bookingId ? await db.Booking.findByPk(bookingId) : null);
  if (!b) return { skipped: true, reason: 'missing_booking' };

  const customerPk = b.customer_id || b.user_id;
  const u =
    user ||
    (userId ? await db.User.findByPk(userId) : customerPk ? await db.User.findByPk(customerPk) : null);
  if (!u) return { skipped: true, reason: 'missing_user' };

  const { subject, message, sms, bookingIdDisplay, serviceTypeLabel } = buildBookingAcceptedCopy({
    booking: b
  });

  const results = { email: null, sms: null, booking_id_display: bookingIdDisplay, service_type_label: serviceTypeLabel };

  if (u.email) {
    try {
      const html = generateEmailTemplate({
        title: subject,
        message,
        footer: 'Thank you for choosing Car Comfort.',
        preheader: message
      });
      results.email = await sendEmail({ to: u.email, subject, text: message, html });
    } catch (err) {
      logger.error('Booking accepted email failed', { bookingId: b.id, userId: u.id, message: err?.message });
      results.email = { failed: true };
    }
  } else {
    results.email = { skipped: true, reason: 'missing_email' };
  }

  if (u.phone) {
    try {
      results.sms = await sendSms({ to: u.phone, text: sms });
    } catch (err) {
      logger.error('Booking accepted SMS failed', { bookingId: b.id, userId: u.id, message: err?.message });
      results.sms = { failed: true };
    }
  } else {
    results.sms = { skipped: true, reason: 'missing_phone' };
  }

  return results;
}

async function sendBookingConfirmedNotifications({ bookingId, booking, userId, user }) {
  const b = booking || (bookingId ? await db.Booking.findByPk(bookingId) : null);
  if (!b) return { skipped: true, reason: 'missing_booking' };

  const customerPk = b.customer_id || b.user_id;
  const u =
    user ||
    (userId ? await db.User.findByPk(userId) : customerPk ? await db.User.findByPk(customerPk) : null);
  if (!u) return { skipped: true, reason: 'missing_user' };

  const customerName = u.first_name || u.name || 'Valued Customer';
  const { subject, message, sms, bookingIdDisplay, serviceTypeLabel } = buildBookingConfirmedCopy({ booking: b, customerName });

  const results = { email: null, sms: null, booking_id_display: bookingIdDisplay, service_type_label: serviceTypeLabel };

  // Best-effort notifications: booking confirmation should not fail if SMS/email providers are down.
  if (u.email) {
    try {
      const html = generateEmailTemplate({
        title: subject,
        message,
        footer: `Sincerely,\nCarComfort`,
        preheader: `Your ${serviceTypeLabel} booking is confirmed${bookingIdDisplay ? ` (${bookingIdDisplay})` : ''}.`,
      });

      let attachments;
      try {
        const [latestTxn, bookingWithDetails, beforePhotoCount, afterPhotoCount] =
          await Promise.all([
            db.BookingTransaction.findOne({
              where: { booking_id: b.id, user_id: u.id },
              order: [['created_at', 'DESC']],
            }),
            db.Booking.findOne({
              where: { id: b.id },
              include: [
                { model: db.Vehicle, as: 'vehicle' },
                {
                  model: db.User,
                  as: 'assigned_driver',
                  attributes: ['id', 'first_name', 'last_name', 'name', 'email', 'phone'],
                  required: false,
                },
              ],
            }),
            db.BookingImage.count({
              where: { booking_id: b.id, image_type: 'before_service' },
            }),
            db.BookingImage.count({
              where: { booking_id: b.id, image_type: 'after_service' },
            }),
          ]);
        const token = latestTxn?.transaction_code ? String(latestTxn.transaction_code) : '';
        const invoiceId = latestTxn?.id;
        const paymentStatus = latestTxn?.status === 'succeeded' ? 'Paid' : null;
        const bookingPlain = bookingWithDetails
          ? bookingWithDetails.get({ plain: true })
          : b;
        const pdf = await generateBookingInvoicePdf({
          booking: bookingPlain,
          user: u,
          vehicle: bookingPlain.vehicle || null,
          driver: bookingPlain.assigned_driver || null,
          token,
          invoiceId,
          paymentStatus,
          beforePhotoCount,
          afterPhotoCount,
        });
        const fileId = b?.booking_code ? String(b.booking_code) : String(b?.id || 'booking');
        attachments = [
          {
            filename: `invoice-${fileId}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ];
      } catch (err) {
        logger.error('Invoice PDF generation failed', { bookingId: b.id, userId: u.id, message: err?.message });
      }

      results.email = await sendEmail({ to: u.email, subject, text: message, html, attachments });
    } catch (err) {
      logger.error('Booking confirmed email failed', { bookingId: b.id, userId: u.id, message: err?.message });
      results.email = { failed: true };
    }
  } else {
    results.email = { skipped: true, reason: 'missing_email' };
  }

  if (u.phone) {
    try {
      results.sms = await sendSms({ to: u.phone, text: sms });
    } catch (err) {
      logger.error('Booking confirmed SMS failed', { bookingId: b.id, userId: u.id, message: err?.message });
      results.sms = { failed: true };
    }
  } else {
    results.sms = { skipped: true, reason: 'missing_phone' };
  }

  return results;
}

async function sendBookingCancelledEmail({ bookingId, booking, userId, user, cancellation }) {
  const b = booking || (bookingId ? await db.Booking.findByPk(bookingId) : null);
  if (!b) return { skipped: true, reason: 'missing_booking' };

  const customerPk = b.customer_id || b.user_id;
  const u =
    user ||
    (userId ? await db.User.findByPk(userId) : customerPk ? await db.User.findByPk(customerPk) : null);
  if (!u) return { skipped: true, reason: 'missing_user' };

  const { subject, message, preheader, bookingIdDisplay, serviceTypeLabel } = buildBookingCancelledCopy({
    booking: b,
    cancellation
  });

  if (!u.email) return { skipped: true, reason: 'missing_email', booking_id_display: bookingIdDisplay, service_type_label: serviceTypeLabel };

  try {
    const html = generateEmailTemplate({
      title: 'Booking cancelled',
      message,
      footer: 'Thank you for choosing Car Comfort.',
      preheader
    });

    const email = await sendEmail({ to: u.email, subject, text: message, html });
    return { email, booking_id_display: bookingIdDisplay, service_type_label: serviceTypeLabel };
  } catch (err) {
    logger.error('Booking cancelled email failed', { bookingId: b.id, userId: u.id, message: err?.message });
    return { email: { failed: true }, booking_id_display: bookingIdDisplay, service_type_label: serviceTypeLabel };
  }
}

module.exports = {
  sendBookingConfirmedNotifications,
  buildBookingConfirmedCopy,
  sendBookingCancelledEmail,
  buildBookingCancelledCopy,
  sendBookingAcceptedNotifications,
  buildBookingAcceptedCopy
};

