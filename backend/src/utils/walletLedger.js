'use strict';

const { ensureAbsoluteUrl } = require('./fileUpload');

const TX_ACCEPT_CREDIT = 'booking_accept_credit';
const TX_SERVICE_START_ADVANCE = 'booking_service_start_advance';
const TX_COMPLETE_RELEASE = 'booking_complete_release';
const TX_COMPLETE_BALANCE = 'booking_complete_balance';
const TX_CANCEL_REVERSAL = 'booking_cancel_reversal';
const TX_TIP_CREDIT = 'booking_tip_credit';
const TX_CANCELLATION_PROVIDER_SHARE = 'cancellation_provider_share';
const TX_PAYOUT_DEBIT = 'payout_debit';

/** Transaction types shown in the service provider app payment history. */
const PROVIDER_HISTORY_TRANSACTION_TYPES = [
  TX_COMPLETE_RELEASE,
  TX_TIP_CREDIT,
  TX_PAYOUT_DEBIT,
  TX_CANCELLATION_PROVIDER_SHARE,
];

function providerFacingDisplayTitle(plain) {
  const booking = plain?.booking || null;
  const code = booking?.booking_code ? ` · ${booking.booking_code}` : '';
  switch (plain?.transaction_type) {
    case TX_COMPLETE_RELEASE:
      return `Service earnings${code}`;
    case TX_TIP_CREDIT:
      return `Customer tip${code}`;
    case TX_PAYOUT_DEBIT:
      return plain?.provider_payout_id
        ? `Withdrawal #${plain.provider_payout_id}`
        : 'Withdrawal';
    case TX_CANCELLATION_PROVIDER_SHARE:
      return `Cancellation fee share${code}`;
    default:
      return null;
  }
}

function ledgerMetaForTransactionType(transactionType, overrides = {}) {
  const base = (() => {
    switch (transactionType) {
      case TX_ACCEPT_CREDIT:
      case TX_SERVICE_START_ADVANCE:
        return { ledger_type: 'credit', status: 'pending' };
      case TX_COMPLETE_RELEASE:
      case TX_COMPLETE_BALANCE:
        return { ledger_type: 'credit', status: 'completed' };
      case TX_CANCEL_REVERSAL:
        return { ledger_type: 'debit', status: 'completed' };
      case TX_TIP_CREDIT:
      case TX_CANCELLATION_PROVIDER_SHARE:
        return { ledger_type: 'credit', status: 'completed' };
      case TX_PAYOUT_DEBIT:
        return { ledger_type: 'debit', status: 'pending' };
      case 'adjustment_credit':
        return { ledger_type: 'credit', status: 'completed' };
      case 'adjustment_debit':
      case 'reversal_debit':
        return { ledger_type: 'debit', status: 'completed' };
      default:
        return { ledger_type: 'credit', status: 'completed' };
    }
  })();

  return { ...base, ...overrides };
}

function normalizeProfile(profile) {
  if (!profile) return null;
  if (typeof profile === 'object') return profile;
  if (typeof profile === 'string') {
    const s = profile.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        const unwrapped = JSON.parse(s);
        if (typeof unwrapped === 'string' && unwrapped.trim()) return { avatar_url: unwrapped.trim() };
        if (unwrapped && typeof unwrapped === 'object') return unwrapped;
      } catch (_e) {
        // fall through
      }
    }
    if (s && !s.startsWith('{') && !s.startsWith('[')) return { avatar_url: s };
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function getProfileImageFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const candidate =
    profile.avatar_url ??
    profile.profile_image ??
    profile.profileImage ??
    profile.image_url ??
    profile.image ??
    profile.picture ??
    profile.photo_url ??
    profile.photo ??
    null;
  return candidate ? String(candidate) : null;
}

function formatBookingWithCustomer(booking, req) {
  if (!booking) return null;

  const user = booking.user || null;
  const customerId = Number(booking.customer_id || booking.user_id || user?.id || 0) || null;

  const name =
    (user?.name && String(user.name).trim()) ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const profileImage = getProfileImageFromProfile(normalizeProfile(user?.profile));

  return {
    id: booking.id,
    booking_code: booking.booking_code,
    status: booking.status,
    customer_id: customerId,
    name: customerId ? name : null,
    image: customerId && profileImage ? ensureAbsoluteUrl(req, profileImage) : null,
  };
}

function formatWalletTransactionRow(row, req) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const amount = Math.abs(Number(plain.amount || 0));
  const displayTitle = providerFacingDisplayTitle(plain);
  return {
    id: plain.id,
    type: plain.ledger_type,
    status: plain.status,
    transaction_type: plain.transaction_type,
    amount: Number(amount.toFixed(2)),
    currency: plain.currency || 'usd',
    description: plain.description,
    display_title: displayTitle || plain.description || null,
    booking_id: plain.booking_id,
    provider_payout_id: plain.provider_payout_id,
    balance_after: plain.balance_after != null ? Number(plain.balance_after) : null,
    created_at: plain.created_at ?? plain.createdAt ?? null,
    booking: formatBookingWithCustomer(plain.booking, req),
    payout: plain.payout
      ? {
          id: plain.payout.id,
          status: plain.payout.status,
          stripe_transfer_id: plain.payout.stripe_transfer_id,
        }
      : null,
  };
}

module.exports = {
  TX_ACCEPT_CREDIT,
  TX_SERVICE_START_ADVANCE,
  TX_COMPLETE_RELEASE,
  TX_COMPLETE_BALANCE,
  TX_CANCEL_REVERSAL,
  TX_TIP_CREDIT,
  TX_CANCELLATION_PROVIDER_SHARE,
  TX_PAYOUT_DEBIT,
  PROVIDER_HISTORY_TRANSACTION_TYPES,
  providerFacingDisplayTitle,
  ledgerMetaForTransactionType,
  normalizeProfile,
  getProfileImageFromProfile,
  formatBookingWithCustomer,
  formatWalletTransactionRow,
};
