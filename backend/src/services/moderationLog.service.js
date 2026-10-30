const { Op } = require('sequelize');
const db = require('../models');

async function listModerationLogs(params = {}) {
  const {
    page = 1,
    limit = 30,
    action_type,
    entity_type,
    admin_id,
    date_from,
    date_to,
    moderation_only = 'true',
    search,
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const andParts = [];

  if (action_type) {
    andParts.push({ action_type: { [Op.like]: `%${String(action_type).trim()}%` } });
  }
  if (entity_type) {
    andParts.push({ entity_type: String(entity_type).trim() });
  }
  if (admin_id) {
    andParts.push({ admin_id });
  }
  if (date_from || date_to) {
    andParts.push({
      created_at: {
        ...(date_from ? { [Op.gte]: new Date(date_from) } : {}),
        ...(date_to ? { [Op.lte]: new Date(date_to) } : {}),
      },
    });
  }

  if (moderation_only === 'true' || moderation_only === true) {
    andParts.push({
      [Op.or]: [
        { action_type: { [Op.like]: 'review_%' } },
        { action_type: { [Op.like]: 'report_%' } },
        { action_type: { [Op.like]: 'ticket_%' } },
        { action_type: { [Op.like]: 'faq_%' } },
        { action_type: { [Op.like]: 'user_suspended%' } },
        { action_type: 'review_content_edited' },
      ],
    });
  }

  if (search) {
    const q = String(search).trim();
    if (q) {
      andParts.push({
        [Op.or]: [
          { action_type: { [Op.like]: `%${q}%` } },
          { entity_type: { [Op.like]: `%${q}%` } },
        ],
      });
    }
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};

  const { count, rows } = await db.AdminAuditLog.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'admin', attributes: ['id', 'name', 'email'] }],
    order: [['created_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  const entries = rows.map((r) => {
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
  });

  return {
    logs: entries,
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

module.exports = { listModerationLogs };
