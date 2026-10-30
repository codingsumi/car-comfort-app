const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');

const OPEN_STATUSES = ['open', 'pending', 'in_progress', 'waiting_for_user', 'escalated'];
const PENDING_RESPONSE_STATUSES = ['open', 'pending', 'in_progress'];

function dateRangeWhere(dateFrom, dateTo, field = 'created_at') {
  if (!dateFrom && !dateTo) return undefined;
  return {
    [field]: {
      ...(dateFrom ? { [Op.gte]: new Date(dateFrom) } : {}),
      ...(dateTo ? { [Op.lte]: new Date(dateTo) } : {}),
    },
  };
}

async function getSupportDashboard({ dateFrom, dateTo } = {}) {
  const range = dateRangeWhere(dateFrom, dateTo);
  const ticketWhere = range || {};

  const [
    openTickets,
    pendingResponses,
    resolvedTickets,
    escalatedTickets,
    customerComplaints,
    providerComplaints,
    categoryRows,
    avgResolutionMs,
    recentTickets,
    highPriority,
    escalatedDisputes,
  ] = await Promise.all([
    db.SupportTicket.count({ where: { ...ticketWhere, status: { [Op.in]: OPEN_STATUSES } } }),
    db.SupportTicket.count({ where: { ...ticketWhere, status: { [Op.in]: PENDING_RESPONSE_STATUSES } } }),
    db.SupportTicket.count({ where: { ...ticketWhere, status: 'resolved' } }),
    db.SupportTicket.count({ where: { ...ticketWhere, status: 'escalated' } }),
    db.SupportTicket.count({
      where: { ...ticketWhere, category: { [Op.in]: ['customer_complaint', 'refund_issue', 'payment_issue'] } },
    }),
    db.SupportTicket.count({
      where: { ...ticketWhere, category: { [Op.in]: ['provider_complaint', 'booking_issue'] }, user_type: { [Op.in]: ['driver', 'garage'] } },
    }),
    db.SupportTicket.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      where: { ...ticketWhere, category: { [Op.ne]: null } },
      group: ['category'],
      order: [[literal('count'), 'DESC']],
      limit: 1,
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: [[fn('AVG', literal('TIMESTAMPDIFF(HOUR, created_at, updated_at)')), 'avg_hours']],
      where: { ...ticketWhere, status: { [Op.in]: ['resolved', 'closed'] } },
      raw: true,
    }),
    db.SupportTicket.findAll({
      where: ticketWhere,
      include: [{ model: db.User, as: 'requester', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    db.SupportTicket.findAll({
      where: { status: { [Op.in]: OPEN_STATUSES }, priority: { [Op.in]: ['high', 'urgent', 'critical'] } },
      include: [{ model: db.User, as: 'requester', attributes: ['id', 'name'] }],
      order: [['updated_at', 'DESC']],
      limit: 8,
    }),
    db.BookingDispute.count({ where: { status: { [Op.in]: ['open', 'investigating'] } } }),
  ]);

  const avgHours = Number(avgResolutionMs[0]?.avg_hours || 0);

  return {
    summary: {
      open_tickets: openTickets,
      pending_responses: pendingResponses,
      resolved_tickets: resolvedTickets,
      escalated_tickets: escalatedTickets,
      average_resolution_hours: Math.round(avgHours * 10) / 10,
      customer_complaints: customerComplaints,
      provider_complaints: providerComplaints,
      top_issue_category: categoryRows[0]?.category || 'general',
    },
    live: {
      new_incoming_tickets: recentTickets.filter((t) => {
        const created = new Date(t.created_at);
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return created.getTime() > dayAgo && ['open', 'pending'].includes(t.status);
      }).map((r) => r.get({ plain: true })),
      high_priority_cases: highPriority.map((r) => r.get({ plain: true })),
      escalated_disputes: escalatedDisputes,
    },
    recent_tickets: recentTickets.map((r) => r.get({ plain: true })),
  };
}

async function getLiveSupportWidgets() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newTickets, pendingAdmin, highPriority, escalated, unreadEstimate] = await Promise.all([
    db.SupportTicket.count({ where: { created_at: { [Op.gte]: dayAgo }, status: { [Op.in]: ['open', 'pending'] } } }),
    db.SupportTicket.count({ where: { status: { [Op.in]: PENDING_RESPONSE_STATUSES } } }),
    db.SupportTicket.count({
      where: { status: { [Op.in]: OPEN_STATUSES }, priority: { [Op.in]: ['high', 'urgent', 'critical'] } },
    }),
    db.SupportTicket.count({ where: { status: 'escalated' } }),
    db.SupportTicket.count({
      where: {
        status: { [Op.in]: PENDING_RESPONSE_STATUSES },
        last_message_at: { [Op.gte]: dayAgo },
      },
    }),
  ]);

  return {
    new_incoming_tickets: newTickets,
    unread_messages: unreadEstimate,
    high_priority_cases: highPriority,
    escalated_disputes: escalated,
    pending_responses: pendingAdmin,
  };
}

async function getIssueAnalytics({ dateFrom, dateTo } = {}) {
  const range = dateRangeWhere(dateFrom, dateTo);
  const ticketWhere = range || {};

  const [
    categoryBreakdown,
    refundReasons,
    providerTrends,
    customerCategories,
    avgResponseRows,
    avgResolutionRows,
    volumeTrend,
    resolutionTrend,
    escalationTrend,
  ] = await Promise.all([
    db.SupportTicket.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      where: ticketWhere,
      group: ['category'],
      order: [[literal('count'), 'DESC']],
      raw: true,
    }),
    db.RefundRequest.findAll({
      attributes: ['reason', [fn('COUNT', col('id')), 'count']],
      where: dateRangeWhere(dateFrom, dateTo),
      group: ['reason'],
      order: [[literal('count'), 'DESC']],
      limit: 10,
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: {
        ...ticketWhere,
        user_type: { [Op.in]: ['driver', 'garage'] },
        category: 'provider_complaint',
      },
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      where: { ...ticketWhere, user_type: 'customer' },
      group: ['category'],
      order: [[literal('count'), 'DESC']],
      raw: true,
    }),
    db.sequelize
      .query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, t.created_at, m.first_admin_at)) AS avg_minutes
         FROM support_tickets t
         INNER JOIN (
           SELECT ticket_id, MIN(created_at) AS first_admin_at
           FROM support_messages
           WHERE sender_role = 'admin' AND internal_note = 0
           GROUP BY ticket_id
         ) m ON m.ticket_id = t.id`,
        { type: db.sequelize.QueryTypes.SELECT }
      )
      .catch(() => [{ avg_minutes: 0 }]),
    db.SupportTicket.findAll({
      attributes: [[fn('AVG', literal('TIMESTAMPDIFF(HOUR, created_at, updated_at)')), 'avg_hours']],
      where: { ...ticketWhere, status: { [Op.in]: ['resolved', 'closed'] } },
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: ticketWhere,
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      limit: 30,
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: [
        [fn('DATE', col('updated_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { ...ticketWhere, status: { [Op.in]: ['resolved', 'closed'] } },
      group: [fn('DATE', col('updated_at'))],
      order: [[fn('DATE', col('updated_at')), 'ASC']],
      limit: 30,
      raw: true,
    }),
    db.SupportTicket.findAll({
      attributes: [
        [fn('DATE', col('escalated_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { ...ticketWhere, escalated_at: { [Op.ne]: null } },
      group: [fn('DATE', col('escalated_at'))],
      order: [[fn('DATE', col('escalated_at')), 'ASC']],
      limit: 30,
      raw: true,
    }),
  ]);

  const avgResponseMinutes = Math.round(Number(avgResponseRows[0]?.avg_minutes || 0));
  const avgResolutionHours = Math.round(Number(avgResolutionRows[0]?.avg_hours || 0) * 10) / 10;

  return {
    most_common_complaints: categoryBreakdown.map((r) => ({
      category: r.category || 'general',
      count: Number(r.count),
    })),
    frequent_refund_reasons: refundReasons
      .filter((r) => r.reason)
      .map((r) => ({ reason: r.reason, count: Number(r.count) })),
    provider_complaint_trends: providerTrends.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    customer_issue_categories: customerCategories.map((r) => ({
      category: r.category || 'general',
      count: Number(r.count),
    })),
    average_response_minutes: avgResponseMinutes,
    average_resolution_hours: avgResolutionHours,
    charts: {
      ticket_volume_trends: volumeTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
      resolution_trends: resolutionTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
      escalation_trends: escalationTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
      category_distribution: categoryBreakdown.map((r) => ({
        category: r.category || 'general',
        count: Number(r.count),
      })),
    },
  };
}

module.exports = {
  getSupportDashboard,
  getLiveSupportWidgets,
  getIssueAnalytics,
};
