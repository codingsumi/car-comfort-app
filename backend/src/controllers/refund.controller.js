const db = require('../models');
const { HttpError } = require('../utils/httpError');

function getAuthUserIdOrThrow(req) {
  const userId = req.auth?.userId;
  if (!userId) throw new HttpError(401, 'Unauthorized');
  return userId;
}

async function requestRefund(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const booking_transaction_id = Number.parseInt(String(req.body.booking_transaction_id), 10);
    if (!booking_transaction_id || booking_transaction_id < 1) throw new HttpError(400, 'booking_transaction_id is required');

    const txn = await db.BookingTransaction.findOne({ where: { id: booking_transaction_id, user_id: userId } });
    if (!txn) throw new HttpError(404, 'Transaction not found');
    if (txn.status !== 'succeeded') throw new HttpError(400, 'Only succeeded transactions can be refunded');

    const existing = await db.RefundRequest.findOne({
      where: { booking_transaction_id: txn.id, user_id: userId, status: ['requested', 'approved', 'processing'] }
    });
    if (existing) throw new HttpError(409, 'Refund already requested');

    const reason = req.body.reason ? String(req.body.reason) : null;
    const rr = await db.RefundRequest.create({
      booking_transaction_id: txn.id,
      user_id: userId,
      reason,
      status: 'requested'
    });

    return res.success('Refund requested', rr.get({ plain: true }), 201);
  } catch (err) {
    return next(err);
  }
}

async function listRefundRequests(req, res, next) {
  try {
    const userId = getAuthUserIdOrThrow(req);
    const rows = await db.RefundRequest.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
    return res.success('Refund requests fetched', rows.map((r) => r.get({ plain: true })));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requestRefund,
  listRefundRequests
};

