'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { isOneSignalConfigured } = require('../config/onesignal');
const { sendPushToUser } = require('../modules/notifications/push.provider');
const { getProviderAfterAcceptMessage } = require('../constants/bookingAfterBookingMessages');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function formatMoney(amount, currency = 'usd') {
  const value = roundTwo(amount);
  const code = String(currency || 'usd').trim().toLowerCase();
  const symbol = code === 'usd' ? '$' : '';
  return `${symbol}${value.toFixed(2)}`;
}

function bookingLabel(booking) {
  if (!booking) return 'booking';
  return booking.booking_code ? String(booking.booking_code) : `#${booking.id}`;
}

function customerDisplayName(user) {
  if (!user) return 'A customer';
  const name =
    (user.name && String(user.name).trim()) ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || 'A customer';
}

function ratingStarsLabel(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n) || n < 1) return 'a rating';
  const whole = Math.round(n);
  return whole === 1 ? '1-star' : `${whole}-star`;
}

function buildEarningsReleasedCopy({ releaseAmount, booking, wallet }) {
  const currency = wallet?.currency || 'usd';
  const label = bookingLabel(booking);
  const money = formatMoney(releaseAmount, currency);
  const withdrawableNow = roundTwo(wallet?.available_for_payout ?? 0);
  const pendingStripe = roundTwo(wallet?.pending_stripe_settlement ?? 0);

  if (withdrawableNow > 0 && pendingStripe <= 0) {
    return {
      title: 'Earnings available to withdraw',
      message: `${money} from ${label} is available to withdraw. Your withdrawable balance is ${formatMoney(withdrawableNow, currency)}.`,
    };
  }

  if (withdrawableNow > 0 && pendingStripe > 0) {
    return {
      title: 'Earnings available to withdraw',
      message:
        `${money} from ${label} was added to your wallet. You can withdraw ${formatMoney(withdrawableNow, currency)} now; ` +
        `${formatMoney(pendingStripe, currency)} is still processing with Stripe.`,
    };
  }

  if (pendingStripe > 0) {
    return {
      title: 'Earnings added to your wallet',
      message:
        `${money} from ${label} was added to your wallet. ${formatMoney(pendingStripe, currency)} is still processing with Stripe—` +
        'withdrawals open when Stripe clears those funds.',
    };
  }

  return {
    title: 'Earnings added to your wallet',
    message:
      `${money} from ${label} was added to your wallet. Withdrawals will be enabled once payout processing completes.`,
  };
}

async function persistAndPush({
  userId,
  bookingId = null,
  notificationType,
  deliveryKey,
  title,
  message,
  data,
}) {
  const uid = Number(userId);
  if (!uid || !deliveryKey || !notificationType) {
    return { skipped: true, reason: 'invalid_payload' };
  }

  const payload = {
    ...(data && typeof data === 'object' ? data : {}),
    kind: data?.kind || notificationType,
  };

  try {
    const [row] = await db.AppNotification.findOrCreate({
      where: { delivery_key: String(deliveryKey) },
      defaults: {
        user_id: uid,
        booking_id: bookingId ? Number(bookingId) : null,
        notification_type: String(notificationType),
        title: String(title || ''),
        message: String(message || ''),
        data: payload,
        is_read: false,
        sent_status: 'pending',
        push_result: null,
      },
    });

    let pushOutcome = { skipped: true, reason: 'onesignal_not_configured' };
    if (isOneSignalConfigured()) {
      try {
        pushOutcome = await sendPushToUser(uid, {
          title: String(title || 'Car Comfort'),
          body: String(message || ''),
          data: {
            ...payload,
            notification_id: String(row.id),
            uniqueKey: String(deliveryKey),
          },
          idempotencyKey: String(deliveryKey),
        });
      } catch (err) {
        logger.warn('driver_notify_push_failed', {
          userId: uid,
          notificationType,
          deliveryKey,
          message: err?.message,
        });
        pushOutcome = { skipped: true, reason: err?.message || 'push_failed' };
      }
    }

    await row.update({
      sent_status: pushOutcome?.skipped ? 'skipped' : 'sent',
      push_result: pushOutcome,
    });

    return { ok: true, notification_id: row.id, push: pushOutcome };
  } catch (err) {
    logger.error('driver_notify_failed', {
      userId: uid,
      notificationType,
      deliveryKey,
      message: err?.message,
    });
    return { skipped: true, reason: err?.message || 'notification_failed' };
  }
}

async function notifyDriverBookingAssigned({ bookingId, driverUserId }) {
  const bid = Number(bookingId);
  const uid = Number(driverUserId);
  if (!bid || !uid) return { skipped: true, reason: 'invalid_payload' };

  const booking = await db.Booking.findByPk(bid, {
    attributes: ['id', 'booking_code', 'service_type', 'status', 'schedule_type'],
  });
  if (!booking) return { skipped: true, reason: 'missing_booking' };

  const copy = getProviderAfterAcceptMessage(booking.schedule_type);

  return persistAndPush({
    userId: uid,
    bookingId: bid,
    notificationType: 'BOOKING_ASSIGNED_DRIVER',
    deliveryKey: `${bid}:BOOKING_ASSIGNED_DRIVER:user:${uid}`,
    title: copy.title,
    message: copy.body,
    data: {
      kind: 'BOOKING_ASSIGNED_DRIVER',
      booking_id: String(bid),
      booking_code: booking.booking_code != null ? String(booking.booking_code) : '',
      service_type: booking.service_type != null ? String(booking.service_type) : '',
      booking_status: booking.status != null ? String(booking.status) : '',
    },
  });
}

async function notifyDriverBookingCancelled({
  bookingId,
  driverUserId,
  cancelledBy,
  message,
}) {
  const bid = Number(bookingId);
  const uid = Number(driverUserId);
  if (!bid || !uid) return { skipped: true, reason: 'invalid_payload' };

  const safeMessage =
    message || 'This booking has been cancelled.';

  return persistAndPush({
    userId: uid,
    bookingId: bid,
    notificationType: 'BOOKING_CANCELLED_DRIVER',
    deliveryKey: `${bid}:BOOKING_CANCELLED_DRIVER:user:${uid}`,
    title: 'Booking cancelled',
    message: safeMessage,
    data: {
      kind: 'BOOKING_CANCELLED_DRIVER',
      booking_id: String(bid),
      cancelled_by: cancelledBy || null,
    },
  });
}

async function notifyDriverEarningsReleased({ providerId, booking, amount, wallet: walletHint }) {
  const uid = Number(providerId);
  const bid = Number(booking?.id);
  const releaseAmount = roundTwo(amount);
  if (!uid || !bid || releaseAmount <= 0) {
    return { skipped: true, reason: 'invalid_payload' };
  }

  let wallet = walletHint;
  try {
    const { getProviderWalletDisplay } = require('./providerWallet.service');
    wallet = await getProviderWalletDisplay(uid);
  } catch (err) {
    logger.warn('earnings_released_wallet_display_fallback', {
      providerId: uid,
      bookingId: bid,
      message: err?.message,
    });
  }

  const currency = wallet?.currency || 'usd';
  const withdrawableNow = roundTwo(wallet?.available_for_payout ?? 0);
  const { title, message } = buildEarningsReleasedCopy({
    releaseAmount,
    booking,
    wallet,
  });

  return persistAndPush({
    userId: uid,
    bookingId: bid,
    notificationType: 'EARNINGS_RELEASED',
    deliveryKey: `${bid}:EARNINGS_RELEASED:provider:${uid}`,
    title,
    message,
    data: {
      kind: 'EARNINGS_RELEASED',
      booking_id: String(bid),
      booking_code: booking?.booking_code != null ? String(booking.booking_code) : '',
      amount: releaseAmount,
      currency,
      available_for_payout: withdrawableNow,
      internal_available_for_payout: roundTwo(wallet?.internal_available_for_payout ?? withdrawableNow),
      pending_stripe_settlement: roundTwo(wallet?.pending_stripe_settlement ?? 0),
    },
  });
}

async function notifyDriverPayoutInitiated({ payout, wallet }) {
  const uid = Number(payout?.provider_id);
  const payoutId = Number(payout?.id);
  if (!uid || !payoutId) return { skipped: true, reason: 'invalid_payload' };

  const currency = payout.currency || wallet?.currency || 'usd';
  const amount = roundTwo(payout.net_amount ?? payout.gross_amount ?? 0);
  const money = formatMoney(amount, currency);

  return persistAndPush({
    userId: uid,
    bookingId: null,
    notificationType: 'PAYOUT_INITIATED',
    deliveryKey: `payout:${payoutId}:initiated`,
    title: 'Payout requested',
    message: `Your payout of ${money} has been initiated and is being processed.`,
    data: {
      kind: 'PAYOUT_INITIATED',
      payout_id: String(payoutId),
      amount,
      currency,
      status: payout.status != null ? String(payout.status) : 'pending',
    },
  });
}

async function notifyDriverPayoutCompleted({ payout }) {
  const uid = Number(payout?.provider_id);
  const payoutId = Number(payout?.id);
  if (!uid || !payoutId) return { skipped: true, reason: 'invalid_payload' };

  const amount = roundTwo(payout.net_amount ?? payout.gross_amount ?? 0);
  const money = formatMoney(amount, 'usd');

  return persistAndPush({
    userId: uid,
    bookingId: null,
    notificationType: 'PAYOUT_COMPLETED',
    deliveryKey: `payout:${payoutId}:completed`,
    title: 'Payout completed',
    message: `Your payout of ${money} has been completed successfully.`,
    data: {
      kind: 'PAYOUT_COMPLETED',
      payout_id: String(payoutId),
      amount,
      status: 'paid',
      stripe_transfer_id: payout.stripe_transfer_id
        ? String(payout.stripe_transfer_id)
        : null,
    },
  });
}

async function notifyDriverCustomerReview({ booking, review, customerUserId }) {
  const providerId = Number(booking?.assigned_driver_user_id);
  const bid = Number(booking?.id);
  const reviewId = Number(review?.id);
  const uid = Number(customerUserId);
  if (!providerId || !bid || !reviewId) {
    return { skipped: true, reason: 'invalid_payload' };
  }

  let customer = null;
  if (uid) {
    customer = await db.User.findByPk(uid, {
      attributes: ['id', 'name', 'first_name', 'last_name'],
    });
  } else if (booking?.user_id) {
    customer = await db.User.findByPk(Number(booking.user_id), {
      attributes: ['id', 'name', 'first_name', 'last_name'],
    });
  }

  const name = customerDisplayName(customer);
  const label = bookingLabel(booking);
  const stars = ratingStarsLabel(review?.rating);

  return persistAndPush({
    userId: providerId,
    bookingId: bid,
    notificationType: 'CUSTOMER_REVIEW_RECEIVED',
    deliveryKey: `${bid}:CUSTOMER_REVIEW_RECEIVED:review:${reviewId}:provider:${providerId}`,
    title: 'New customer review',
    message: `${name} left a ${stars} review for ${label}.`,
    data: {
      kind: 'CUSTOMER_REVIEW_RECEIVED',
      booking_id: String(bid),
      booking_code: booking?.booking_code != null ? String(booking.booking_code) : '',
      review_id: String(reviewId),
      rating: Number(review.rating) || null,
      customer_user_id: customer?.id != null ? String(customer.id) : '',
    },
  });
}

async function notifyDriverCustomerTip({ tip, booking }) {
  const providerId = Number(tip?.provider_user_id);
  const bid = Number(booking?.id || tip?.booking_id);
  const tipId = Number(tip?.id);
  const amount = roundTwo(tip?.amount);
  if (!providerId || !bid || !tipId || amount <= 0) {
    return { skipped: true, reason: 'invalid_payload' };
  }

  let bookingRow = booking;
  if (!bookingRow?.booking_code) {
    bookingRow = await db.Booking.findByPk(bid, {
      attributes: ['id', 'booking_code', 'assigned_driver_user_id'],
    });
  }

  const label = bookingLabel(bookingRow);
  const money = formatMoney(amount, tip?.currency || 'usd');

  return persistAndPush({
    userId: providerId,
    bookingId: bid,
    notificationType: 'CUSTOMER_TIP_RECEIVED',
    deliveryKey: `${bid}:CUSTOMER_TIP_RECEIVED:tip:${tipId}:provider:${providerId}`,
    title: 'You received a tip',
    message: `A customer sent you a ${money} tip for ${label}.`,
    data: {
      kind: 'CUSTOMER_TIP_RECEIVED',
      booking_id: String(bid),
      booking_code: bookingRow?.booking_code != null ? String(bookingRow.booking_code) : '',
      tip_id: String(tipId),
      amount,
      currency: String(tip?.currency || 'usd'),
    },
  });
}

async function notifyDriverPayoutFailed({ payout, failureReason }) {
  const uid = Number(payout?.provider_id);
  const payoutId = Number(payout?.id);
  if (!uid || !payoutId) return { skipped: true, reason: 'invalid_payload' };

  const amount = roundTwo(payout.net_amount ?? payout.gross_amount ?? 0);
  const money = formatMoney(amount, 'usd');
  const reason = String(failureReason || payout.failure_reason || '').trim();
  const message = reason
    ? `Your payout of ${money} failed. ${reason}`
    : `Your payout of ${money} could not be completed. The amount has been returned to your available balance.`;

  return persistAndPush({
    userId: uid,
    bookingId: null,
    notificationType: 'PAYOUT_FAILED',
    deliveryKey: `payout:${payoutId}:failed`,
    title: 'Payout failed',
    message,
    data: {
      kind: 'PAYOUT_FAILED',
      payout_id: String(payoutId),
      amount,
      failure_reason: reason || null,
      status: 'failed',
    },
  });
}

module.exports = {
  notifyDriverBookingAssigned,
  notifyDriverBookingCancelled,
  notifyDriverEarningsReleased,
  notifyDriverCustomerReview,
  notifyDriverCustomerTip,
  notifyDriverPayoutInitiated,
  notifyDriverPayoutCompleted,
  notifyDriverPayoutFailed,
};
