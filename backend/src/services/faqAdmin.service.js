const { Op } = require('sequelize');
const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { sanitizePlainText } = require('../utils/userContentSanitize');

async function listFaqs(params = {}) {
  const { category_id, status, search, page = 1, limit = 50 } = params;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const where = {};
  if (category_id) where.category_id = category_id;
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { question: { [Op.like]: `%${search}%` } },
      { answer: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await db.Faq.findAndCountAll({
    where,
    include: [{ model: db.FaqCategory, as: 'category', attributes: ['id', 'name', 'slug'] }],
    order: [
      ['category_id', 'ASC'],
      ['sort_order', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: limitNum,
    offset,
  });

  return {
    faqs: rows.map((r) => r.get({ plain: true })),
    pagination: { total: count, page: pageNum, limit: limitNum, total_pages: Math.ceil(count / limitNum) },
  };
}

const DEFAULT_CATEGORIES = [
  { name: 'General', slug: 'general', sort_order: 1 },
  { name: 'Bookings', slug: 'bookings', sort_order: 2 },
  { name: 'Payments & Billing', slug: 'payments-billing', sort_order: 3 },
  { name: 'Service Providers', slug: 'service-providers', sort_order: 4 },
  { name: 'Account & Profile', slug: 'account-profile', sort_order: 5 },
  { name: 'Technical Support', slug: 'technical-support', sort_order: 6 },
];

async function listCategories() {
  let rows = await db.FaqCategory.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  // Auto-seed defaults on first run
  if (rows.length === 0) {
    await db.FaqCategory.bulkCreate(DEFAULT_CATEGORIES, { ignoreDuplicates: true }).catch(() => {});
    rows = await db.FaqCategory.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  }
  return rows.map((r) => r.get({ plain: true }));
}

async function createCategory({ name, slug, sort_order = 0 }) {
  const n = sanitizePlainText(name, { maxLength: 120 });
  const rawSlug = slug || n;
  const s = sanitizePlainText(rawSlug, { maxLength: 120 })
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  if (!n || !s) throw new HttpError(400, 'Name is required');
  return db.FaqCategory.create({ name: n, slug: s, sort_order });
}

async function createFaq(payload, adminCtx) {
  const question = sanitizePlainText(payload.question, { maxLength: 500 });
  const answer = sanitizePlainText(payload.answer, { maxLength: 20000 });
  if (!question || !answer) throw new HttpError(400, 'Question and answer are required');

  const row = await db.Faq.create({
    category_id: payload.category_id,
    question,
    answer,
    status: payload.status === 'published' ? 'published' : 'draft',
    sort_order: Number(payload.sort_order) || 0,
  });

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'faq_created',
    entity_type: 'faq',
    entity_id: row.id,
    details: { question },
    ip_address: adminCtx.ipAddress,
  });

  return row;
}

async function updateFaq(id, payload, adminCtx) {
  const row = await db.Faq.findByPk(id);
  if (!row) throw new HttpError(404, 'FAQ not found');

  const prev = row.get({ plain: true });
  const updates = {};
  if (payload.category_id) updates.category_id = payload.category_id;
  if (payload.question) updates.question = sanitizePlainText(payload.question, { maxLength: 500 });
  if (payload.answer) updates.answer = sanitizePlainText(payload.answer, { maxLength: 20000 });
  if (payload.status) updates.status = payload.status === 'published' ? 'published' : 'draft';
  if (payload.sort_order !== undefined) updates.sort_order = Number(payload.sort_order) || 0;

  await row.update(updates);

  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'faq_updated',
    entity_type: 'faq',
    entity_id: id,
    details: { previous: prev, next: row.get({ plain: true }) },
    ip_address: adminCtx.ipAddress,
  });

  return row.reload({ include: [{ model: db.FaqCategory, as: 'category' }] });
}

async function reorderFaqs(orderedIds, adminCtx) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    throw new HttpError(400, 'ordered_ids array is required');
  }
  let order = 0;
  for (const id of orderedIds) {
    // eslint-disable-next-line no-await-in-loop
    await db.Faq.update({ sort_order: order }, { where: { id } });
    order += 1;
  }
  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'faq_reordered',
    entity_type: 'faq',
    entity_id: 0,
    details: { ordered_ids: orderedIds },
    ip_address: adminCtx.ipAddress,
  });
  return { updated: orderedIds.length };
}

async function deleteFaq(id, adminCtx) {
  const row = await db.Faq.findByPk(id);
  if (!row) throw new HttpError(404, 'FAQ not found');
  await row.destroy();
  await db.AdminAuditLog.create({
    admin_id: adminCtx.adminId,
    action_type: 'faq_deleted',
    entity_type: 'faq',
    entity_id: id,
    details: {},
    ip_address: adminCtx.ipAddress,
  });
  return { deleted: true };
}

module.exports = {
  listFaqs,
  listCategories,
  createCategory,
  createFaq,
  updateFaq,
  reorderFaqs,
  deleteFaq,
};
