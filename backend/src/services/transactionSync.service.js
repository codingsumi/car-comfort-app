const db = require('../models');
const { logger } = require('../config/logger');
const { resolveBookingProviderCompensationAmount } = require('../utils/providerCompensation');
const { resolveComboServicePackageRow } = require('./bookingPriceSummary.service');

function pad4(n) {
  return String(n).padStart(4, '0');
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

let dailyCounter = 0;
let lastDateStr = '';

function generateFinanceCode() {
  const now = new Date();
  const dateStr = formatDate(now);
  if (dateStr !== lastDateStr) {
    dailyCounter = 0;
    lastDateStr = dateStr;
  }
  dailyCounter += 1;
  return `FTX-${dateStr}-${pad4(dailyCounter)}`;
}

async function syncBookingPayment({ bookingTransaction, booking }) {
  try {
    const transactionCode = generateFinanceCode();

    const platformFee = parseFloat(booking.platform_fee || 0);
    const serviceFee = parseFloat(booking.service_fee || 0);
    const tax = parseFloat(booking.tax || 0);
    const totalPrice = parseFloat(booking.total_price || 0);
    const commissionAmount = platformFee + serviceFee;
    const plain = booking?.get ? booking.get({ plain: true }) : booking;
    const comboPackageRow =
      String(plain?.service_type || '').trim() === 'combo'
        ? await resolveComboServicePackageRow({ packageRow: plain?.package })
        : null;
    const providerEarning = resolveBookingProviderCompensationAmount(
      plain,
      plain?.package,
      comboPackageRow
    );

    await db.Transaction.create({
      transaction_code: transactionCode,
      booking_id: booking.id,
      booking_transaction_id: bookingTransaction.id,
      customer_id: booking.user_id,
      provider_id: booking.assigned_driver_user_id || null,
      transaction_type: 'booking_payment',
      payment_method: bookingTransaction.payment_method_id ? 'card' : null,
      stripe_payment_intent_id: bookingTransaction.stripe_payment_intent_id || null,
      amount: totalPrice,
      commission_amount: commissionAmount,
      provider_earning: Math.max(0, providerEarning),
      tax_amount: tax,
      refund_amount: 0,
      net_amount: totalPrice,
      status: bookingTransaction.status === 'succeeded' ? 'succeeded' : 'processing',
      metadata: {
        booking_code: booking.booking_code,
        transaction_code: bookingTransaction.transaction_code,
      },
    });
  } catch (err) {
    logger.warn('Failed to sync booking payment to transactions', {
      bookingId: booking?.id,
      error: err?.message,
    });
  }
}

async function syncRefund({ refundRequest, booking, adminId }) {
  try {
    const transactionCode = generateFinanceCode();
    const refundAmount = parseFloat(refundRequest.amount || 0);
    const totalPrice = parseFloat(booking.total_price || 0);
    const isFullRefund = refundAmount >= totalPrice;

    await db.Transaction.create({
      transaction_code: transactionCode,
      booking_id: booking.id,
      booking_transaction_id: refundRequest.booking_transaction_id,
      customer_id: booking.user_id,
      provider_id: booking.assigned_driver_user_id || null,
      transaction_type: isFullRefund ? 'refund' : 'partial_refund',
      stripe_refund_id: refundRequest.stripe_refund_id || null,
      amount: refundAmount,
      commission_amount: 0,
      provider_earning: 0,
      tax_amount: 0,
      refund_amount: refundAmount,
      net_amount: -refundAmount,
      status: refundRequest.stripe_refund_id ? 'refunded' : 'processing',
      metadata: {
        booking_code: booking.booking_code,
        reason: refundRequest.reason,
        processed_by: adminId,
        refund_request_id: refundRequest.id,
      },
    });
  } catch (err) {
    logger.warn('Failed to sync refund to transactions', {
      bookingId: booking?.id,
      error: err?.message,
    });
  }
}

module.exports = {
  syncBookingPayment,
  syncRefund,
};
