const { Op } = require('sequelize');
const db = require('../models');

async function getModerationDashboardSummary({ dateFrom, dateTo } = {}) {
  const createdRange =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { [Op.gte]: new Date(dateFrom) } : {}),
          ...(dateTo ? { [Op.lte]: new Date(dateTo) } : {}),
        }
      : null;

  const reviewWhere = createdRange ? { created_at: createdRange } : undefined;
  const reportWhere = createdRange ? { created_at: createdRange } : undefined;
  const ticketWhere = createdRange ? { created_at: createdRange } : undefined;
  const logWhere = createdRange ? { created_at: createdRange } : undefined;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const moderationActionOr = [
    { action_type: { [Op.like]: 'review_%' } },
    { action_type: { [Op.like]: 'report_%' } },
    { action_type: { [Op.like]: 'ticket_%' } },
    { action_type: { [Op.like]: 'faq_%' } },
    { action_type: { [Op.like]: 'user_suspended%' } },
    { action_type: 'review_content_edited' },
  ];

  const [
    pendingReviews,
    flaggedReviews,
    reportedIssues,
    openSupportTickets,
    removedContentCount,
    abuseSpamReports,
    moderationActionsToday,
    recentFlaggedRows,
    recentReports,
    recentTickets,
    recentLogs,
  ] = await Promise.all([
    db.Review.count({ where: { ...reviewWhere, moderation_status: 'pending' } }),
    db.Review.count({
      where: {
        ...(reviewWhere || {}),
        [Op.or]: [{ moderation_status: 'flagged' }, { flags_count: { [Op.gt]: 0 } }],
      },
    }),
    db.PlatformReport.count({ where: { ...reportWhere, status: { [Op.notIn]: ['resolved', 'dismissed'] } } }),
    db.SupportTicket.count({
      where: {
        ...ticketWhere,
        status: { [Op.in]: ['open', 'pending', 'waiting_for_user'] },
      },
    }),
    db.Review.count({ where: { ...reviewWhere, moderation_status: 'removed' } }),
    db.PlatformReport.count({
      where: {
        ...reportWhere,
        report_type: 'spam_abuse',
        status: { [Op.notIn]: ['resolved', 'dismissed'] },
      },
    }),
    db.AdminAuditLog.count({
      where: {
        created_at: { [Op.gte]: todayStart },
        [Op.or]: moderationActionOr,
      },
    }),
    db.Review.findAll({
      where: {
        moderation_status: 'flagged',
        ...(reviewWhere || {}),
      },
      include: [
        { model: db.User, as: 'reviewer', attributes: ['id', 'name'] },
        { model: db.User, as: 'reviewee', attributes: ['id', 'name'] },
        { model: db.Booking, as: 'booking', attributes: ['id', 'booking_code'] },
      ],
      order: [['updated_at', 'DESC']],
      limit: 8,
      subQuery: false,
    }),
    db.PlatformReport.findAll({
      where: reportWhere,
      include: [
        { model: db.User, as: 'reporter', attributes: ['id', 'name'] },
        { model: db.User, as: 'target', attributes: ['id', 'name'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: 8,
    }),
    db.SupportTicket.findAll({
      where: ticketWhere,
      include: [{ model: db.User, as: 'requester', attributes: ['id', 'name', 'email'] }],
      order: [['updated_at', 'DESC']],
      limit: 8,
    }),
    db.AdminAuditLog.findAll({
      where: { ...(logWhere || {}), [Op.or]: moderationActionOr },
      include: [{ model: db.User, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 12,
    }),
  ]);

  return {
    summary: {
      pending_reviews: pendingReviews,
      flagged_reviews: flaggedReviews,
      reported_issues: reportedIssues,
      open_support_tickets: openSupportTickets,
      removed_content_count: removedContentCount,
      abuse_spam_reports: abuseSpamReports,
      moderation_actions_today: moderationActionsToday,
    },
    recent_flagged_reviews: recentFlaggedRows.map((r) => r.get({ plain: true })),
    recent_reports: recentReports.map((r) => r.get({ plain: true })),
    recent_support_tickets: recentTickets.map((r) => r.get({ plain: true })),
    recent_moderation_actions: recentLogs.map((r) => {
      const plain = r.get({ plain: true });
      const d = plain.details || {};
      return {
        id: plain.id,
        moderator: plain.admin,
        action_type: plain.action_type,
        target_entity: `${plain.entity_type}:${plain.entity_id}`,
        entity_type: plain.entity_type,
        entity_id: plain.entity_id,
        previous_status: d.previous_status ?? d.previous?.status ?? null,
        new_status: d.new_status ?? d.next?.status ?? null,
        details: d,
        ip_address: plain.ip_address,
        created_at: plain.created_at,
      };
    }),
  };
}

module.exports = { getModerationDashboardSummary };
