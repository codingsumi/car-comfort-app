const { Op, fn, col } = require('sequelize');
const db = require('../models');
const { getStripe } = require('../config/stripe');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { computeDriverEarningFromBooking } = require('../utils/bookingDriverEarning');

async function getProviderEarnings(providerId) {
  const completedBookings = await db.Booking.findAll({
    where: {
      assigned_driver_user_id: providerId,
      status: { [Op.in]: ['completed', 'refunded'] },
    },
    attributes: [
      'id',
      'total_price',
      'platform_fee',
      'service_fee',
      'tax',
      'refund_amount',
      'provider_compensation_amount',
      'on_demand_provider_compensation_amount',
      'provider_compensation_type',
      'provider_compensation_value',
      'on_demand_provider_compensation_type',
      'on_demand_provider_compensation_value',
      'schedule_type',
      'base_price',
    ],
  });

  let grossEarning = 0;
  let totalCustomerPaid = 0;
  let totalPlatformFee = 0;
  let totalServiceFee = 0;
  let totalTax = 0;
  let totalRefunds = 0;

  for (const row of completedBookings) {
    const plain = row.get ? row.get({ plain: true }) : row;
    grossEarning += computeDriverEarningFromBooking(plain);
    totalCustomerPaid += parseFloat(plain.total_price || 0);
    totalPlatformFee += parseFloat(plain.platform_fee || 0);
    totalServiceFee += parseFloat(plain.service_fee || 0);
    totalTax += parseFloat(plain.tax || 0);
    totalRefunds += parseFloat(plain.refund_amount || 0);
  }

  const serviceCount = completedBookings.length;
  const commissionDeducted = totalPlatformFee + totalServiceFee;

  const paidPayouts = await db.ProviderPayout.sum('net_amount', {
    where: {
      provider_id: providerId,
      status: { [Op.in]: ['paid', 'scheduled'] },
    },
  });
  const totalPaid = parseFloat(paidPayouts || 0);

  const availableBalance = Math.max(0, grossEarning - totalPaid);

  return {
    total_earnings: parseFloat(totalCustomerPaid.toFixed(2)),
    commission_deducted: parseFloat(commissionDeducted.toFixed(2)),
    tax_deducted: parseFloat(totalTax.toFixed(2)),
    refund_adjustments: parseFloat(totalRefunds.toFixed(2)),
    gross_earning: parseFloat(grossEarning.toFixed(2)),
    total_paid: totalPaid,
    available_balance: parseFloat(availableBalance.toFixed(2)),
    service_count: serviceCount,
  };
}

async function processManualPayout({ providerId, amount, notes, adminId, ipAddress }) {
  const provider = await db.User.findOne({
    where: { id: providerId, role: { [Op.in]: ['driver', 'garage'] } },
  });
  if (!provider) throw new HttpError(404, 'Provider not found');

  const earnings = await getProviderEarnings(providerId);

  if (amount > earnings.available_balance) {
    throw new HttpError(
      400,
      `Payout amount ($${amount.toFixed(2)}) exceeds available balance ($${earnings.available_balance.toFixed(2)})`
    );
  }

  const pendingPayout = await db.ProviderPayout.findOne({
    where: {
      provider_id: providerId,
      status: { [Op.in]: ['pending', 'scheduled'] },
    },
  });
  if (pendingPayout) {
    throw new HttpError(400, 'A payout is already pending/scheduled for this provider');
  }

  let stripeTransfer = null;
  const destinationAccount = provider.stripe_connect_account_id;

  if (destinationAccount) {
    try {
      const stripe = await getStripe();
      stripeTransfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination: destinationAccount,
        description: `Manual payout for provider ${provider.name || provider.id}`,
        metadata: {
          provider_id: String(providerId),
          admin_id: String(adminId),
          notes: notes || '',
        },
      });
    } catch (err) {
      logger.error('Stripe transfer failed', { providerId, error: err?.message });
      throw new HttpError(502, `Stripe transfer failed: ${err?.message || 'Unknown error'}`);
    }
  }

  const payout = await db.ProviderPayout.create({
    provider_id: providerId,
    stripe_transfer_id: stripeTransfer?.id || null,
    stripe_destination_account: destinationAccount || null,
    gross_amount: amount,
    commission_deducted: 0,
    vacuum_fee_deducted: 0,
    refund_adjustments: 0,
    tax_deducted: 0,
    net_amount: amount,
    status: stripeTransfer ? 'paid' : 'pending',
    notes: notes || null,
    processed_by: adminId,
    processed_at: new Date(),
    service_count: earnings.service_count,
  });

  await db.Transaction.create({
    transaction_code: `PYT-${Date.now()}`,
    provider_id: providerId,
    transaction_type: 'manual_payout',
    stripe_transfer_id: stripeTransfer?.id || null,
    amount: amount,
    net_amount: -amount,
    status: stripeTransfer ? 'succeeded' : 'pending',
    metadata: { payout_id: payout.id, notes },
  });

  await db.FinancialAuditLog.create({
    admin_id: adminId,
    action: 'manual_payout',
    entity_type: 'provider_payout',
    entity_id: payout.id,
    new_values: {
      provider_id: providerId,
      amount,
      stripe_transfer_id: stripeTransfer?.id,
    },
    ip_address: ipAddress,
    notes,
  });

  return payout;
}

async function getPayoutDashboardStats() {
  const [pending, paid, failed, upcoming, platformRevenue] = await Promise.all([
    db.ProviderPayout.sum('net_amount', { where: { status: 'pending' } }),
    db.ProviderPayout.sum('net_amount', { where: { status: 'paid' } }),
    db.ProviderPayout.sum('net_amount', { where: { status: 'failed' } }),
    db.ProviderPayout.sum('net_amount', { where: { status: 'scheduled' } }),
    db.Booking.sum('platform_fee', {
      where: { status: 'completed' },
    }),
  ]);

  return {
    total_pending: parseFloat(pending || 0),
    total_paid: parseFloat(paid || 0),
    total_failed: parseFloat(failed || 0),
    total_upcoming: parseFloat(upcoming || 0),
    platform_revenue: parseFloat(platformRevenue || 0),
  };
}

module.exports = {
  getProviderEarnings,
  processManualPayout,
  getPayoutDashboardStats,
};
