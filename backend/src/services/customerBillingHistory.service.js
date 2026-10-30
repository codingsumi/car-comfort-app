const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { assertCustomerAuth } = require('../utils/customerAuth');

const SUCCEEDED_STATUSES = ['succeeded'];
const PENDING_STATUSES = [
  'requires_payment_method',
  'requires_action',
  'processing'
];

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(String(query?.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(query?.limit || '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function formatBillingRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const booking = plain.booking || null;
  const createdAt = plain.created_at ?? plain.createdAt ?? null;
  return {
    id: plain.id,
    transaction_code: plain.transaction_code,
    amount: Number(plain.amount),
    currency: plain.currency,
    status: plain.status,
    created_at: createdAt,
    booking: booking
      ? {
          id: booking.id,
          booking_code: booking.booking_code,
          service_type: booking.service_type,
          status: booking.status
        }
      : null
  };
}

async function listCustomerBillingHistory(req, query = {}) {
  const userId = assertCustomerAuth(req);
  const { page, limit, offset } = parsePagination(query);

  const statusFilter = String(query?.status || 'all').trim().toLowerCase();
  const where = { user_id: userId };

  if (statusFilter === 'completed' || statusFilter === 'succeeded') {
    where.status = { [Op.in]: SUCCEEDED_STATUSES };
  } else if (statusFilter === 'pending') {
    where.status = { [Op.in]: PENDING_STATUSES };
  } else if (statusFilter !== 'all') {
    throw new HttpError(400, 'status must be all, completed, or pending');
  }

  const { rows, count } = await db.BookingTransaction.findAndCountAll({
    where,
    include: [
      {
        model: db.Booking,
        as: 'booking',
        required: false,
        attributes: ['id', 'booking_code', 'service_type', 'status']
      }
    ],
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit,
    offset
  });

  return {
    transactions: rows.map(formatBillingRow),
    pagination: {
      total: count,
      page,
      limit,
      total_pages: count ? Math.ceil(count / limit) : 0
    }
  };
}

module.exports = {
  listCustomerBillingHistory
};
