'use strict';

const db = require('../models');
const { resolveBookingProviderCompensationAmount, roundTwo } = require('./providerCompensation');
const { TX_CANCELLATION_PROVIDER_SHARE } = require('./walletLedger');

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Provider payout for a completed booking (admin package compensation; not part of customer bill).
 */
function computeDriverEarningFromBooking(booking, comboPackageRow = null) {
  const plain = booking?.get ? booking.get({ plain: true }) : booking || {};
  const pkg = plain.package || null;
  const comboPkg = comboPackageRow || plain.combo_package || null;
  return roundTwo(
    Math.max(0, resolveBookingProviderCompensationAmount(plain, pkg, comboPkg))
  );
}

function resolveDriverEarningKind(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  const reason = String(booking?.cancellation_reason || '').trim().toLowerCase();

  if (status !== 'cancelled') {
    return { kind: 'service', payout_label: 'Service payout' };
  }

  if (reason === 'customer_no_show') {
    return {
      kind: 'no_show',
      payout_label: 'Customer no-show share',
      note:
        'Service was not completed. You receive the no-show fee share instead of the full service payout.',
    };
  }

  const share = toAmount(booking?.provider_cancellation_share_amount);
  if (share > 0) {
    return {
      kind: 'cancellation_share',
      payout_label: 'Cancellation fee share',
      note: 'You receive your share of the customer cancellation fee.',
    };
  }

  return { kind: 'cancelled', payout_label: null, note: null };
}

async function resolveCancelledDriverShareAmount(booking) {
  const stored = toAmount(booking?.provider_cancellation_share_amount);
  if (stored > 0) return stored;

  const bookingId = Number(booking?.id);
  if (!bookingId || !db.ProviderWalletTransaction) return 0;

  const shareTxn = await db.ProviderWalletTransaction.findOne({
    where: { booking_id: bookingId, transaction_type: TX_CANCELLATION_PROVIDER_SHARE },
    attributes: ['amount'],
    order: [['id', 'DESC']],
  });
  if (shareTxn?.amount != null) {
    return roundTwo(shareTxn.amount);
  }

  return 0;
}

/**
 * Effective provider payout shown in driver apps (completed service vs no-show / cancellation share).
 */
async function resolveDriverEarningForBooking(booking, comboPackageRow = null) {
  const plain = booking?.get ? booking.get({ plain: true }) : booking || {};
  const status = String(plain.status || '').trim().toLowerCase();
  const kindInfo = resolveDriverEarningKind(plain);

  if (status === 'cancelled') {
    const shareAmount = await resolveCancelledDriverShareAmount(plain);
    const plannedServicePayout = computeDriverEarningFromBooking(plain, comboPackageRow);
    const amount = shareAmount > 0 ? shareAmount : 0;

    return {
      amount,
      kind: shareAmount > 0 ? kindInfo.kind : 'cancelled',
      payout_label: shareAmount > 0 ? kindInfo.payout_label : null,
      note: shareAmount > 0 ? kindInfo.note : null,
      cancellation_fee: toAmount(plain.cancellation_fee) || null,
      planned_service_payout:
        plannedServicePayout > amount ? roundTwo(plannedServicePayout) : null,
      currency: 'usd',
    };
  }

  return {
    amount: computeDriverEarningFromBooking(plain, comboPackageRow),
    kind: 'service',
    payout_label: 'Service payout',
    note: null,
    cancellation_fee: null,
    planned_service_payout: null,
    currency: 'usd',
  };
}

async function buildDriverEarningSummary({
  booking,
  tip = null,
  financeProviderEarning = null,
  comboPackageRow = null,
}) {
  const resolved = await resolveDriverEarningForBooking(booking, comboPackageRow);
  let amount = resolved.amount;

  if (
    resolved.kind === 'service' &&
    financeProviderEarning != null &&
    toAmount(financeProviderEarning) > 0
  ) {
    amount = roundTwo(financeProviderEarning);
  }

  const tipAmount =
    tip?.status === 'succeeded' && tip?.amount != null ? roundTwo(tip.amount) : 0;

  return {
    amount,
    tip_amount: tipAmount > 0 ? tipAmount : null,
    total_payout: roundTwo(amount + tipAmount),
    currency: resolved.currency || 'usd',
    kind: resolved.kind,
    payout_label: resolved.payout_label,
    note: resolved.note,
    cancellation_fee: resolved.cancellation_fee,
    planned_service_payout: resolved.planned_service_payout,
  };
}

module.exports = {
  computeDriverEarningFromBooking,
  resolveDriverEarningForBooking,
  buildDriverEarningSummary,
};
