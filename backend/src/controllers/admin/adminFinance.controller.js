const { Op, fn, col, literal } = require('sequelize');
const db = require('../../models');
const { HttpError } = require('../../utils/httpError');
const { getProviderEarnings, processManualPayout, getPayoutDashboardStats } = require('../../services/payout.service');

// ─── LIST TRANSACTIONS ────────────────────────────────────────────────────────

async function listTransactions(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      transaction_type,
      from_date,
      to_date,
      customer_id,
      provider_id,
      amount_min,
      amount_max,
      payment_method,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (status) where.status = status;
    if (transaction_type) where.transaction_type = transaction_type;
    if (payment_method) where.payment_method = payment_method;
    if (customer_id) where.customer_id = customer_id;
    if (provider_id) where.provider_id = provider_id;

    if (from_date) {
      where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(from_date) };
    }
    if (to_date) {
      const endDate = new Date(to_date);
      endDate.setHours(23, 59, 59, 999);
      where.created_at = { ...(where.created_at || {}), [Op.lte]: endDate };
    }

    if (amount_min) {
      where.amount = { ...(where.amount || {}), [Op.gte]: parseFloat(amount_min) };
    }
    if (amount_max) {
      where.amount = { ...(where.amount || {}), [Op.lte]: parseFloat(amount_max) };
    }

    const includeConfig = [
      { model: db.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
      { model: db.User, as: 'provider', attributes: ['id', 'name', 'email', 'phone'] },
      {
        model: db.Booking,
        as: 'booking',
        attributes: ['id', 'booking_code', 'service_type', 'status', 'address'],
        required: false,
      },
    ];

    if (search) {
      where[Op.or] = [
        { transaction_code: { [Op.like]: `%${search}%` } },
        { stripe_payment_intent_id: { [Op.like]: `%${search}%` } },
        { '$customer.name$': { [Op.like]: `%${search}%` } },
        { '$provider.name$': { [Op.like]: `%${search}%` } },
        { '$booking.booking_code$': { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ['created_at', 'amount', 'status', 'transaction_type', 'net_amount'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const result = await db.Transaction.findAndCountAll({
      where,
      include: includeConfig,
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
      subQuery: false,
    });

    const stats = await db.Transaction.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total_count'],
        [fn('SUM', fn('IF', { [Op.and]: [{ status: 'succeeded' }, { transaction_type: 'booking_payment' }] }, col('amount'), 0)), 'total_revenue'],
      ],
      raw: true,
    });

    const [summaryStats] = await db.Transaction.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total_count'],
        [
          literal("SUM(CASE WHEN transaction_type = 'booking_payment' AND status = 'succeeded' THEN amount ELSE 0 END)"),
          'total_revenue',
        ],
        [
          literal("SUM(CASE WHEN transaction_type IN ('refund','partial_refund') THEN refund_amount ELSE 0 END)"),
          'total_refunds',
        ],
        [
          literal("SUM(CASE WHEN transaction_type = 'booking_payment' AND status = 'succeeded' THEN commission_amount ELSE 0 END)"),
          'total_commission',
        ],
      ],
      raw: true,
    });

    return res.success('Transactions fetched', {
      rows: result.rows,
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
      stats: {
        total_count: parseInt(summaryStats?.total_count || 0),
        total_revenue: parseFloat(summaryStats?.total_revenue || 0),
        total_refunds: parseFloat(summaryStats?.total_refunds || 0),
        total_commission: parseFloat(summaryStats?.total_commission || 0),
        net_revenue: parseFloat((summaryStats?.total_revenue || 0) - (summaryStats?.total_refunds || 0)),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ─── GET TRANSACTION DETAIL ───────────────────────────────────────────────────

async function getTransaction(req, res, next) {
  try {
    const { id } = req.params;

    const transaction = await db.Transaction.findByPk(id, {
      include: [
        { model: db.User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: db.User, as: 'provider', attributes: ['id', 'name', 'email', 'phone'] },
        {
          model: db.Booking,
          as: 'booking',
          include: [
            { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
            { model: db.User, as: 'assigned_driver', attributes: ['id', 'name', 'email'] },
            { model: db.Package, as: 'package', include: [{ model: db.Service, as: 'service' }] },
          ],
        },
        {
          model: db.BookingTransaction,
          as: 'booking_transaction',
          include: [
            {
              model: db.RefundRequest,
              as: 'refund_requests',
            },
          ],
        },
      ],
    });

    if (!transaction) throw new HttpError(404, 'Transaction not found');

    let refundHistory = [];
    if (transaction.booking_id) {
      refundHistory = await db.RefundRequest.findAll({
        where: { booking_id: transaction.booking_id },
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
        ],
        order: [['created_at', 'DESC']],
      });
    }

    return res.success('Transaction fetched', {
      transaction,
      refund_history: refundHistory,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── LIST PAYOUTS ─────────────────────────────────────────────────────────────

async function listPayouts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      provider_id,
      search,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (provider_id) where.provider_id = provider_id;

    // Search by provider name, email, phone or ID
    if (search) {
      const isNumeric = /^\d+$/.test(search.trim());
      if (isNumeric) {
        where[Op.or] = [
          { provider_id: parseInt(search) },
          { '$provider.name$': { [Op.like]: `%${search}%` } },
          { '$provider.email$': { [Op.like]: `%${search}%` } },
        ];
      } else {
        where[Op.or] = [
          { '$provider.name$': { [Op.like]: `%${search}%` } },
          { '$provider.email$': { [Op.like]: `%${search}%` } },
          { '$provider.phone$': { [Op.like]: `%${search}%` } },
        ];
      }
    }

    const validSortFields = ['created_at', 'net_amount', 'status', 'gross_amount'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const result = await db.ProviderPayout.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'phone', 'stripe_connect_account_id'],
        },
        { model: db.User, as: 'processor', attributes: ['id', 'name'] },
      ],
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
      subQuery: false,
    });

    return res.success('Payouts fetched', {
      rows: result.rows,
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── PAYOUT DASHBOARD STATS ──────────────────────────────────────────────────

async function getPayoutDashboard(req, res, next) {
  try {
    const stats = await getPayoutDashboardStats();
    return res.success('Payout dashboard stats fetched', stats);
  } catch (err) {
    return next(err);
  }
}

// ─── PROCESS MANUAL PAYOUT ────────────────────────────────────────────────────

async function handleManualPayout(req, res, next) {
  try {
    const { provider_id, amount, notes } = req.body;
    const adminId = req.auth.userId;
    const ip = req.ip || req.headers['x-forwarded-for'];

    if (!provider_id) throw new HttpError(400, 'Provider ID is required');
    if (!amount || parseFloat(amount) <= 0) {
      throw new HttpError(400, 'Payout amount must be greater than 0');
    }

    const payout = await processManualPayout({
      providerId: provider_id,
      amount: parseFloat(amount),
      notes,
      adminId,
      ipAddress: ip,
    });

    return res.success('Payout processed successfully', payout, 201);
  } catch (err) {
    return next(err);
  }
}

// ─── GET PAYOUT DETAIL ────────────────────────────────────────────────────────

async function getPayoutDetail(req, res, next) {
  try {
    const { id } = req.params;

    const payout = await db.ProviderPayout.findByPk(id, {
      include: [
        {
          model: db.User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'phone', 'stripe_connect_account_id'],
        },
        { model: db.User, as: 'processor', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!payout) throw new HttpError(404, 'Payout not found');

    const earnings = await getProviderEarnings(payout.provider_id);

    return res.success('Payout detail fetched', {
      payout,
      provider_earnings: earnings,
    });
  } catch (err) {
    return next(err);
  }
}

// ─── GET PROVIDER EARNINGS ────────────────────────────────────────────────────

async function getProviderEarningsEndpoint(req, res, next) {
  try {
    const { providerId } = req.params;
    const earnings = await getProviderEarnings(providerId);
    return res.success('Provider earnings fetched', earnings);
  } catch (err) {
    return next(err);
  }
}

// ─── EXPORT TRANSACTIONS CSV ──────────────────────────────────────────────────

async function exportTransactionsCsv(req, res, next) {
  try {
    const { from_date, to_date, status, transaction_type } = req.query;

    const where = {};
    if (status) where.status = status;
    if (transaction_type) where.transaction_type = transaction_type;
    if (from_date) where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(from_date) };
    if (to_date) {
      const endDate = new Date(to_date);
      endDate.setHours(23, 59, 59, 999);
      where.created_at = { ...(where.created_at || {}), [Op.lte]: endDate };
    }

    const transactions = await db.Transaction.findAll({
      where,
      include: [
        { model: db.User, as: 'customer', attributes: ['id', 'name', 'email'] },
        { model: db.User, as: 'provider', attributes: ['id', 'name', 'email'] },
        { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: 10000,
    });

    const headers = [
      'Transaction ID', 'Booking ID', 'Customer', 'Provider', 'Type',
      'Payment Method', 'Amount', 'Commission', 'Provider Earning', 'Tax',
      'Refund Amount', 'Net Amount', 'Status', 'Date',
    ];

    const rows = transactions.map((t) => [
      t.transaction_code,
      t.booking?.booking_code || '',
      t.customer?.name || '',
      t.provider?.name || '',
      t.transaction_type,
      t.payment_method || '',
      t.amount,
      t.commission_amount,
      t.provider_earning,
      t.tax_amount,
      t.refund_amount,
      t.net_amount,
      t.status,
      t.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((r) =>
      r.map((v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
}

// ─── LIST REFUND HISTORY ─────────────────────────────────────────────────────

async function listRefundHistory(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      from_date,
      to_date,
      provider_id,
      search,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;

    if (from_date) {
      where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(from_date) };
    }
    if (to_date) {
      const endDate = new Date(to_date);
      endDate.setHours(23, 59, 59, 999);
      where.created_at = { ...(where.created_at || {}), [Op.lte]: endDate };
    }

    const includeConfig = [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
      {
        model: db.BookingTransaction,
        as: 'booking_transaction',
        attributes: ['id', 'transaction_code', 'amount', 'status'],
        include: [
          {
            model: db.Booking,
            as: 'booking',
            attributes: ['id', 'booking_code', 'service_type', 'status'],
            ...(provider_id ? { where: { assigned_driver_user_id: provider_id }, required: true } : { required: false }),
          },
        ],
      },
    ];

    if (search) {
      where[Op.or] = [
        { reason: { [Op.like]: `%${search}%` } },
        { stripe_refund_id: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ['created_at', 'amount', 'status', 'processed_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const result = await db.RefundRequest.findAndCountAll({
      where,
      include: includeConfig,
      order: [[sortField, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
      subQuery: false,
    });

    const [summary] = await db.RefundRequest.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total_requests'],
        [literal("SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END)"), 'total_refunded'],
        [literal("SUM(CASE WHEN status = 'pending' OR status = 'requested' OR status = 'processing' THEN amount ELSE 0 END)"), 'pending_amount'],
      ],
      raw: true,
    });

    return res.success('Refund history fetched', {
      rows: result.rows,
      count: result.count,
      totalPages: Math.ceil(result.count / limitNum),
      currentPage: pageNum,
      stats: {
        total_requests: parseInt(summary?.total_requests || 0),
        total_refunded: parseFloat(summary?.total_refunded || 0),
        pending_amount: parseFloat(summary?.pending_amount || 0),
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTransactions,
  getTransaction,
  listPayouts,
  getPayoutDashboard,
  handleManualPayout,
  getPayoutDetail,
  getProviderEarningsEndpoint,
  exportTransactionsCsv,
  listRefundHistory,
};
