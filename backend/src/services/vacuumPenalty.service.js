const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');

async function createPenalty({ providerId, bookingId, penaltyAmount, deductionType, reason, evidenceUrls, adminId, ipAddress }) {
  const provider = await db.User.findOne({
    where: { id: providerId, role: 'driver' },
  });
  if (!provider) throw new HttpError(404, 'Provider not found');

  if (bookingId) {
    const booking = await db.Booking.findOne({
      where: { id: bookingId, assigned_driver_user_id: providerId },
    });
    if (!booking) throw new HttpError(404, 'Booking not found or not assigned to this provider');
  }

  const amount = parseFloat(penaltyAmount);
  if (!amount || amount <= 0) throw new HttpError(400, 'Penalty amount must be greater than 0');

  const penalty = await db.VacuumPenalty.create({
    provider_id: providerId,
    booking_id: bookingId || null,
    penalty_amount: amount,
    deduction_type: deductionType || 'fixed',
    reason,
    evidence_urls: evidenceUrls || null,
    issued_by: adminId,
    status: 'applied',
  });

  await db.FinancialAuditLog.create({
    admin_id: adminId,
    action: 'deduction_applied',
    entity_type: 'vacuum_penalty',
    entity_id: penalty.id,
    new_values: {
      provider_id: providerId,
      booking_id: bookingId,
      penalty_amount: amount,
      deduction_type: deductionType || 'fixed',
      reason,
    },
    ip_address: ipAddress,
    notes: `Vacuum penalty: ${reason}`,
  });

  await db.AdminAuditLog.create({
    admin_id: adminId,
    action_type: 'vacuum_penalty_issued',
    entity_type: 'user',
    entity_id: providerId,
    details: { penalty_id: penalty.id, amount, reason },
    ip_address: ipAddress,
  });

  return penalty;
}

async function listPenalties(providerId, params = {}) {
  const { page = 1, limit = 10 } = params;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const where = { provider_id: providerId };

  const { count, rows } = await db.VacuumPenalty.findAndCountAll({
    where,
    include: [
      { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      { model: db.User, as: 'issuer', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  const totalDeductions = await db.VacuumPenalty.sum('penalty_amount', {
    where: { provider_id: providerId, status: { [Op.ne]: 'reversed' } },
  });

  return {
    penalties: rows,
    total_deductions: parseFloat(totalDeductions || 0),
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(count / limitNum),
    },
  };
}

async function reversePenalty(penaltyId, adminId, ipAddress) {
  const penalty = await db.VacuumPenalty.findByPk(penaltyId);
  if (!penalty) throw new HttpError(404, 'Penalty not found');
  if (penalty.status === 'reversed') throw new HttpError(400, 'Penalty already reversed');

  await penalty.update({ status: 'reversed' });

  await db.FinancialAuditLog.create({
    admin_id: adminId,
    action: 'deduction_applied',
    entity_type: 'vacuum_penalty',
    entity_id: penalty.id,
    previous_values: { status: 'applied' },
    new_values: { status: 'reversed' },
    ip_address: ipAddress,
    notes: 'Vacuum penalty reversed',
  });

  return penalty;
}

module.exports = {
  createPenalty,
  listPenalties,
  reversePenalty,
};
