'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { logger } = require('../config/logger');
const { getStripeClientFromSettings } = require('../config/stripe');
const { getProviderWalletSummary, getOrCreateWallet, reconcileProviderCreditTransactionStatuses } = require('./providerWallet.service');
const { assertKycComplete, getConnectStatusWithKycLink } = require('./stripeConnect.service');
const { getPlatformBalanceAmounts } = require('./stripeBalance.service');
const {
  TX_PAYOUT_DEBIT,
  PROVIDER_HISTORY_TRANSACTION_TYPES,
  ledgerMetaForTransactionType,
  formatWalletTransactionRow,
} = require('../utils/walletLedger');
const {
  notifyDriverPayoutInitiated,
  notifyDriverPayoutCompleted,
  notifyDriverPayoutFailed,
} = require('./driverNotify.service');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function assertDriverAuth(auth) {
  const userId = auth?.userId ? Number(auth.userId) : null;
  const role = String(auth?.role || '').trim();
  if (!userId) throw new HttpError(401, 'Unauthorized');
  if (role !== 'driver') throw new HttpError(403, 'Forbidden');

  const driverProfile = await db.DriverProfile.findOne({ where: { user_id: userId } });
  if (!driverProfile) throw new HttpError(403, 'Service provider profile required');

  return userId;
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(String(query?.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query?.limit || '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

async function listDriverWalletTransactions(auth, query = {}, req = null) {
  const providerId = await assertDriverAuth(auth);

  try {
    await reconcileProviderCreditTransactionStatuses(providerId);
  } catch (err) {
    logger.warn('driver_payment_history_reconcile_failed', {
      providerId,
      message: err?.message,
    });
  }

  const { page, limit, offset } = parsePagination(query);

  const where = {
    provider_id: providerId,
    transaction_type: { [Op.in]: PROVIDER_HISTORY_TRANSACTION_TYPES },
  };

  const type = query?.type ? String(query.type).trim().toLowerCase() : null;
  if (type) {
    if (!['credit', 'debit'].includes(type)) {
      throw new HttpError(400, 'type must be credit or debit');
    }
    where.ledger_type = type;
  }

  const status = query?.status ? String(query.status).trim().toLowerCase() : null;
  if (status) {
    if (!['pending', 'completed', 'failed'].includes(status)) {
      throw new HttpError(400, 'status must be pending, completed, or failed');
    }
    where.status = status;
  }

  const { rows, count } = await db.ProviderWalletTransaction.findAndCountAll({
    where,
    include: [
      {
        model: db.Booking,
        as: 'booking',
        required: false,
        attributes: ['id', 'booking_code', 'status', 'user_id', 'customer_id'],
        include: [
          {
            model: db.User,
            as: 'user',
            required: false,
            attributes: ['id', 'name', 'first_name', 'last_name', 'profile'],
          },
        ],
      },
      {
        model: db.ProviderPayout,
        as: 'payout',
        required: false,
        attributes: ['id', 'status', 'stripe_transfer_id'],
      },
    ],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });

  return {
    transactions: rows.map((row) => formatWalletTransactionRow(row, req)),
    pagination: {
      total: count,
      page,
      limit,
      total_pages: count ? Math.ceil(count / limit) : 0,
    },
  };
}

async function requestDriverPayout(auth, { amount: amountRaw } = {}) {
  const providerId = await assertDriverAuth(auth);
  await assertKycComplete(providerId);

  const user = await db.User.findByPk(providerId, {
    attributes: ['id', 'name', 'email', 'stripe_connect_account_id'],
  });
  if (!user?.stripe_connect_account_id) {
    throw new HttpError(400, 'Complete Stripe KYC before requesting a payout');
  }

  const t = await db.sequelize.transaction();
  let payout;
  let walletTxn;
  let requestAmount;
  let stripeBalance;

  try {
    const wallet = await getOrCreateWallet(providerId, t);
    const available = roundTwo(wallet.available_for_payout);
    stripeBalance = await getPlatformBalanceAmounts({ currency: wallet.currency || 'usd' });
    const stripeAvailable = roundTwo(Math.max(0, stripeBalance.available));
    const payableAvailable = roundTwo(Math.min(available, stripeAvailable));

    requestAmount =
      amountRaw === undefined || amountRaw === null || amountRaw === ''
        ? payableAvailable
        : roundTwo(amountRaw);

    if (!requestAmount || requestAmount <= 0) {
      if (available > 0 && payableAvailable <= 0) {
        throw new HttpError(409, 'Funds are still pending in Stripe and are not available for payout yet', {
          internal_available_for_payout: available,
          stripe_available_for_payout: stripeAvailable,
          pending_stripe_settlement: roundTwo(Math.max(0, available - stripeAvailable)),
        });
      }
      throw new HttpError(400, 'Payout amount must be greater than zero');
    }
    if (requestAmount > available) {
      throw new HttpError(400, `Amount exceeds available for payout ($${available.toFixed(2)})`);
    }
    if (requestAmount > payableAvailable) {
      throw new HttpError(409, `Funds are still pending in Stripe. Available for payout is $${payableAvailable.toFixed(2)}.`, {
        internal_available_for_payout: available,
        stripe_available_for_payout: stripeAvailable,
        pending_stripe_settlement: roundTwo(Math.max(0, available - stripeAvailable)),
      });
    }

    const pendingPayout = await db.ProviderPayout.findOne({
      where: {
        provider_id: providerId,
        status: { [Op.in]: ['pending', 'scheduled'] },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (pendingPayout) {
      throw new HttpError(409, 'A payout is already in progress');
    }

    const newAvailable = roundTwo(available - requestAmount);
    await wallet.update({ available_for_payout: newAvailable }, { transaction: t });

    payout = await db.ProviderPayout.create(
      {
        provider_id: providerId,
        initiated_by: 'driver',
        stripe_destination_account: user.stripe_connect_account_id,
        gross_amount: requestAmount,
        commission_deducted: 0,
        vacuum_fee_deducted: 0,
        refund_adjustments: 0,
        tax_deducted: 0,
        net_amount: requestAmount,
        status: 'pending',
        notes: 'Driver-initiated payout',
        service_count: 0,
      },
      { transaction: t }
    );

    const ledgerMeta = ledgerMetaForTransactionType(TX_PAYOUT_DEBIT);

    walletTxn = await db.ProviderWalletTransaction.create(
      {
        provider_id: providerId,
        provider_payout_id: payout.id,
        transaction_type: TX_PAYOUT_DEBIT,
        ledger_type: ledgerMeta.ledger_type,
        status: ledgerMeta.status,
        amount: requestAmount,
        balance_after: newAvailable,
        currency: wallet.currency || 'usd',
        description: `Payout #${payout.id}`,
      },
      { transaction: t }
    );

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const walletAfterDebit = await getOrCreateWallet(providerId, null);
  void notifyDriverPayoutInitiated({ payout, wallet: walletAfterDebit }).catch((err) => {
    logger.warn('driver_payout_initiated_notify_failed', {
      providerId,
      payoutId: payout.id,
      message: err?.message,
    });
  });

  let stripeTransfer = null;
  try {
    const stripe = await getStripeClientFromSettings(db);
    stripeTransfer = await stripe.transfers.create({
      amount: Math.round(requestAmount * 100),
      currency: 'usd',
      destination: user.stripe_connect_account_id,
      description: `Service provider payout #${payout.id}`,
      metadata: {
        payout_id: String(payout.id),
        provider_id: String(providerId),
        initiated_by: 'driver',
      },
    });

    await payout.update({
      status: 'paid',
      stripe_transfer_id: stripeTransfer.id,
      processed_at: new Date(),
    });
    await walletTxn.update({ status: 'completed' });
    await payout.reload();
    void notifyDriverPayoutCompleted({ payout }).catch((notifyErr) => {
      logger.warn('driver_payout_completed_notify_failed', {
        providerId,
        payoutId: payout.id,
        message: notifyErr?.message,
      });
    });
  } catch (err) {
    logger.error('driver_payout_stripe_failed', {
      providerId,
      payoutId: payout.id,
      message: err?.message,
    });

    const rollback = await db.sequelize.transaction();
    try {
      const wallet = await getOrCreateWallet(providerId, rollback);
      await wallet.update(
        {
          available_for_payout: roundTwo(toAmount(wallet.available_for_payout) + requestAmount),
        },
        { transaction: rollback }
      );
      await payout.update(
        {
          status: 'failed',
          failure_reason: err?.message || 'Stripe transfer failed',
        },
        { transaction: rollback }
      );
      await walletTxn.update({ status: 'failed' }, { transaction: rollback });
      await rollback.commit();
      await payout.reload();
      void notifyDriverPayoutFailed({
        payout,
        failureReason: err?.message || 'Stripe transfer failed',
      }).catch((notifyErr) => {
        logger.warn('driver_payout_failed_notify_failed', {
          providerId,
          payoutId: payout.id,
          message: notifyErr?.message,
        });
      });
    } catch (rollbackErr) {
      await rollback.rollback();
      logger.error('driver_payout_rollback_failed', {
        payoutId: payout.id,
        message: rollbackErr?.message,
      });
    }

    throw new HttpError(502, `Payout transfer failed: ${err?.message || 'Unknown error'}`);
  }

  const wallet = await getProviderWalletSummary(providerId);

  return {
    payout: {
      id: payout.id,
      amount: requestAmount,
      status: 'paid',
      stripe_transfer_id: stripeTransfer.id,
      initiated_by: 'driver',
      processed_at: payout.processed_at,
    },
    wallet,
    transaction: formatWalletTransactionRow(
      await walletTxn.reload({
        include: [{ model: db.ProviderPayout, as: 'payout', attributes: ['id', 'status', 'stripe_transfer_id'] }],
      }),
      null
    ),
  };
}

async function getDriverStripeConnectStatus(auth) {
  const providerId = await assertDriverAuth(auth);
  return getConnectStatusWithKycLink(providerId);
}

module.exports = {
  listDriverWalletTransactions,
  requestDriverPayout,
  getDriverStripeConnectStatus,
};
