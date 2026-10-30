'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { getOrCreateWallet } = require('./providerWallet.service');
const { syncRefund } = require('./transactionSync.service');
const { TX_PAYOUT_DEBIT } = require('../utils/walletLedger');
const {
  notifyDriverPayoutCompleted,
  notifyDriverPayoutFailed,
} = require('./driverNotify.service');

/** Recommended Stripe Dashboard webhook event types for this integration. */
const STRIPE_WEBHOOK_EVENT_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'charge.refund.updated',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'transfer.created',
  'transfer.updated',
  'transfer.reversed',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
  'payout.updated',
  'account.updated',
  'capability.updated',
  'balance.available',
];

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function findProviderPayoutByTransfer(transfer) {
  const transferId = transfer?.id ? String(transfer.id) : null;
  if (transferId) {
    const row = await db.ProviderPayout.findOne({ where: { stripe_transfer_id: transferId } });
    if (row) return row;
  }

  const payoutId = Number(transfer?.metadata?.payout_id || 0);
  if (payoutId > 0) {
    return db.ProviderPayout.findByPk(payoutId);
  }

  return null;
}

async function findProviderPayoutByStripePayout(stripePayout) {
  const transferId = stripePayout?.source_transfer || stripePayout?.transfer || null;
  if (transferId) {
    const row = await db.ProviderPayout.findOne({ where: { stripe_transfer_id: String(transferId) } });
    if (row) return row;
  }
  return null;
}

async function findWalletTxnForPayout(payoutId, transaction = null) {
  return db.ProviderWalletTransaction.findOne({
    where: { provider_payout_id: payoutId, transaction_type: TX_PAYOUT_DEBIT },
    transaction,
  });
}

async function confirmProviderPayoutPaid(payout, transfer = null) {
  if (!payout) return { updated: false, reason: 'no_payout' };
  if (payout.status === 'paid') return { updated: false, reason: 'already_paid' };

  await payout.update({
    status: 'paid',
    stripe_transfer_id: transfer?.id ? String(transfer.id) : payout.stripe_transfer_id,
    processed_at: payout.processed_at || new Date(),
    failure_reason: null,
  });

  const walletTxn = await findWalletTxnForPayout(payout.id);
  if (walletTxn && walletTxn.status !== 'completed') {
    await walletTxn.update({ status: 'completed' });
  }

  await payout.reload();
  void notifyDriverPayoutCompleted({ payout }).catch((err) => {
    logger.warn('driver_payout_webhook_completed_notify_failed', {
      payoutId: payout.id,
      message: err?.message,
    });
  });

  return { updated: true, payout_id: payout.id, status: 'paid' };
}

async function failProviderPayoutAndRestoreBalance(payout, { failureReason, stripePayload = null } = {}) {
  if (!payout) return { updated: false, reason: 'no_payout' };
  if (payout.status === 'failed') return { updated: false, reason: 'already_failed' };

  const restoreAmount = roundTwo(payout.net_amount);
  const canRestoreBalance =
    payout.status === 'pending' || payout.status === 'scheduled' || payout.status === 'paid';

  const t = await db.sequelize.transaction();
  try {
    const walletTxn = await findWalletTxnForPayout(payout.id, t);
    const shouldRestoreWallet = Boolean(walletTxn) && canRestoreBalance && restoreAmount > 0;

    if (shouldRestoreWallet) {
      const wallet = await getOrCreateWallet(payout.provider_id, t);
      await wallet.update(
        {
          available_for_payout: roundTwo(toAmount(wallet.available_for_payout) + restoreAmount),
        },
        { transaction: t }
      );
    }

    await payout.update(
      {
        status: 'failed',
        failure_reason: failureReason || 'Transfer failed or was reversed',
        ...(stripePayload ? { notes: [payout.notes, JSON.stringify(stripePayload)].filter(Boolean).join('\n') } : {}),
      },
      { transaction: t }
    );

    if (walletTxn && walletTxn.status !== 'failed') {
      await walletTxn.update({ status: 'failed' }, { transaction: t });
    }

    await t.commit();

    await payout.reload();
    void notifyDriverPayoutFailed({
      payout,
      failureReason,
    }).catch((notifyErr) => {
      logger.warn('driver_payout_webhook_failed_notify_failed', {
        payoutId: payout.id,
        message: notifyErr?.message,
      });
    });

    return {
      updated: true,
      payout_id: payout.id,
      restored_amount: shouldRestoreWallet ? restoreAmount : 0,
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function handleTransferEvent(transfer, eventType) {
  const payout = await findProviderPayoutByTransfer(transfer);
  const reversed = Boolean(transfer?.reversed) || Number(transfer?.amount_reversed || 0) > 0;

  if (reversed || eventType === 'transfer.reversed') {
    if (!payout) {
      logger.warn('stripe_webhook_transfer_reversed_no_payout', { transferId: transfer?.id });
      return { handled: true, action: 'transfer_reversed', payout_id: null };
    }
    const result = await failProviderPayoutAndRestoreBalance(payout, {
      failureReason: `Stripe transfer reversed (${eventType})`,
      stripePayload: { transfer_id: transfer.id, eventType },
    });
    return { handled: true, action: 'transfer_reversed', ...result };
  }

  if (!payout) {
    return { handled: false, reason: 'payout_not_found', transfer_id: transfer?.id };
  }

  if (['pending', 'scheduled'].includes(String(payout.status))) {
    const result = await confirmProviderPayoutPaid(payout, transfer);
    return { handled: true, action: eventType, ...result };
  }

  return { handled: true, action: eventType, payout_id: payout.id, status: payout.status, note: 'no_status_change' };
}

async function handleConnectPayoutEvent(stripePayout, eventType) {
  const accountId = stripePayout?.destination || stripePayout?.account || null;
  const provider = accountId
    ? await db.User.findOne({
        where: { stripe_connect_account_id: String(accountId) },
        attributes: ['id', 'stripe_connect_account_id'],
      })
    : null;

  const localPayout = await findProviderPayoutByStripePayout(stripePayout);

  logger.info('stripe_webhook_connect_payout', {
    eventType,
    stripePayoutId: stripePayout?.id,
    status: stripePayout?.status,
    providerId: provider?.id || null,
    localPayoutId: localPayout?.id || null,
    failure_code: stripePayout?.failure_code || null,
  });

  if (localPayout && stripePayout?.status === 'paid' && localPayout.status !== 'paid') {
    await confirmProviderPayoutPaid(localPayout);
    return { handled: true, action: eventType, payout_id: localPayout.id, synced: 'paid' };
  }

  if (
    localPayout &&
    ['failed', 'canceled', 'cancelled'].includes(String(stripePayout?.status || '').toLowerCase())
  ) {
    const result = await failProviderPayoutAndRestoreBalance(localPayout, {
      failureReason: stripePayout.failure_message || stripePayout.failure_code || `Stripe payout ${stripePayout.status}`,
      stripePayload: { stripe_payout_id: stripePayout.id, eventType },
    });
    return { handled: true, action: eventType, ...result };
  }

  return {
    handled: true,
    action: eventType,
    provider_id: provider?.id || null,
    stripe_payout_id: stripePayout?.id,
    status: stripePayout?.status,
  };
}

async function resolveRefundRequest(refund) {
  const refundId = refund?.id ? String(refund.id) : null;
  if (refundId) {
    const byStripe = await db.RefundRequest.findOne({ where: { stripe_refund_id: refundId } });
    if (byStripe) return byStripe;
  }

  const piId = refund?.payment_intent ? String(refund.payment_intent) : null;
  if (piId) {
    const txn = await db.BookingTransaction.findOne({ where: { stripe_payment_intent_id: piId } });
    if (txn) {
      return db.RefundRequest.findOne({
        where: { booking_transaction_id: txn.id },
        order: [['created_at', 'DESC']],
      });
    }
  }

  return null;
}

async function handleRefundEvent(refund, eventType) {
  const refundRequest = await resolveRefundRequest(refund);
  const stripeStatus = String(refund?.status || '').toLowerCase();

  if (refundRequest) {
    const updates = {
      stripe_refund_id: refund.id,
      stripe_payload: refund,
    };

    if (stripeStatus === 'succeeded' || eventType === 'charge.refunded') {
      updates.status = 'refunded';
      updates.processed_at = refundRequest.processed_at || new Date();
    } else if (stripeStatus === 'failed' || eventType === 'refund.failed') {
      updates.status = 'rejected';
    } else if (stripeStatus === 'pending' || stripeStatus === 'processing') {
      updates.status = 'processing';
    }

    await refundRequest.update(updates);

    if (updates.status === 'refunded') {
      const booking = await db.Booking.findByPk(refundRequest.booking_id);
      if (booking) {
        syncRefund({ refundRequest, booking, adminId: refundRequest.processed_by }).catch((err) => {
          logger.warn('stripe_webhook_sync_refund_failed', {
            refundRequestId: refundRequest.id,
            message: err?.message,
          });
        });
      }
    }

    return {
      handled: true,
      action: eventType,
      refund_request_id: refundRequest.id,
      status: updates.status || refundRequest.status,
    };
  }

  const piId = refund?.payment_intent;
  if (piId) {
    const txn = await db.BookingTransaction.findOne({ where: { stripe_payment_intent_id: String(piId) } });
    if (txn && (stripeStatus === 'succeeded' || eventType === 'charge.refunded')) {
      await txn.update({ status: 'cancelled', stripe_payload: refund });
      return { handled: true, action: eventType, booking_transaction_id: txn.id, note: 'txn_marked_cancelled' };
    }
  }

  return { handled: false, reason: 'refund_request_not_found', refund_id: refund?.id };
}

async function handleChargeRefunded(charge) {
  const refunds = charge?.refunds?.data;
  if (Array.isArray(refunds) && refunds.length) {
    const last = refunds[refunds.length - 1];
    return handleRefundEvent(last, 'charge.refunded');
  }

  return handleRefundEvent(
    {
      id: charge?.refund || null,
      payment_intent: charge?.payment_intent,
      status: 'succeeded',
      amount: charge?.amount_refunded,
    },
    'charge.refunded'
  );
}

async function handleCapabilityUpdated(capability) {
  const accountId = capability?.account;
  const user = accountId
    ? await db.User.findOne({
        where: { stripe_connect_account_id: String(accountId) },
        attributes: ['id'],
      })
    : null;

  logger.info('stripe_webhook_capability_updated', {
    accountId,
    userId: user?.id || null,
    capability: capability?.id,
    status: capability?.status,
  });

  return { handled: true, action: 'capability_updated', user_id: user?.id || null };
}

async function handleBalanceAvailable(balance) {
  logger.info('stripe_webhook_balance_available', {
    available: balance?.available,
    connect_reserved: balance?.connect_reserved,
    livemode: balance?.livemode,
  });
  return { handled: true, action: 'balance_available' };
}

module.exports = {
  STRIPE_WEBHOOK_EVENT_TYPES,
  handleTransferEvent,
  handleConnectPayoutEvent,
  handleRefundEvent,
  handleChargeRefunded,
  handleCapabilityUpdated,
  handleBalanceAvailable,
  confirmProviderPayoutPaid,
  failProviderPayoutAndRestoreBalance,
};
