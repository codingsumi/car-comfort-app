const db = require('../models');
const { HttpError } = require('../utils/httpError');
const {
  normalizeAudience,
  normalizeInstructionList
} = require('./tutorialContent.service');

function parseInstructionsJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeInstructionList(parsed);
  } catch (_e) {
    return [];
  }
}

function instructionsFromRow(row) {
  const fromJson = parseInstructionsJson(row.instructions_json);
  if (fromJson.length) return fromJson;
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  if (!description) return [];
  return normalizeInstructionList(description.split(/\r?\n/));
}

function normalizeCategory(value) {
  const raw = String(value || '').trim();
  return raw || 'General';
}

function normalizeTitle(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new HttpError(400, 'title is required');
  if (raw.length > 255) throw new HttpError(400, 'title must be at most 255 characters');
  return raw;
}

function formatTutorialVideoItem(row) {
  return {
    id: row.id,
    audience: row.audience,
    category: row.category,
    title: row.title,
    description: row.description || null,
    instructions: instructionsFromRow(row),
    video_url: row.video_url || null,
    sort_order: row.sort_order,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listTutorialVideoItems({
  audience = 'customer',
  publishedOnly = true
}) {
  const normalizedAudience = normalizeAudience(audience);
  const where = { audience: normalizedAudience };
  if (publishedOnly) where.is_published = true;

  const rows = await db.TutorialVideoItem.findAll({
    where,
    order: [
      ['category', 'ASC'],
      ['sort_order', 'ASC'],
      ['id', 'ASC']
    ]
  });

  const items = rows.map(formatTutorialVideoItem);
  const categories = [...new Set(items.map((item) => item.category))];

  return { items, categories };
}

async function getTutorialVideoItemById(id) {
  const row = await db.TutorialVideoItem.findByPk(id);
  if (!row) throw new HttpError(404, 'Tutorial video not found');
  return row;
}

async function createTutorialVideoItem(payload) {
  const audience = normalizeAudience(payload.audience);
  const title = normalizeTitle(payload.title);
  const category = normalizeCategory(payload.category);
  const description =
    payload.description == null ? null : String(payload.description).trim() || null;
  const videoUrl =
    payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
  const sortOrder = Number.isFinite(Number(payload.sortOrder))
    ? Math.max(0, Number(payload.sortOrder))
    : 100;
  const isPublished = payload.isPublished !== false;
  const instructions = normalizeInstructionList(payload.instructions);

  const row = await db.TutorialVideoItem.create({
    audience,
    category,
    title,
    description,
    instructions_json: instructions.length ? JSON.stringify(instructions) : null,
    video_url: videoUrl,
    sort_order: sortOrder,
    is_published: isPublished
  });

  return formatTutorialVideoItem(row);
}

async function updateTutorialVideoItem(id, payload) {
  const row = await getTutorialVideoItemById(id);
  const updates = {};

  if (payload.audience != null) updates.audience = normalizeAudience(payload.audience);
  if (payload.title != null) updates.title = normalizeTitle(payload.title);
  if (payload.category != null) updates.category = normalizeCategory(payload.category);
  if (payload.description !== undefined) {
    updates.description =
      payload.description == null ? null : String(payload.description).trim() || null;
  }
  if (payload.videoUrl !== undefined) {
    updates.video_url =
      payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
  }
  if (payload.sortOrder != null) {
    updates.sort_order = Math.max(0, Number(payload.sortOrder) || 0);
  }
  if (payload.isPublished != null) updates.is_published = Boolean(payload.isPublished);
  if (payload.instructions !== undefined) {
    const instructions = normalizeInstructionList(payload.instructions);
    updates.instructions_json = instructions.length ? JSON.stringify(instructions) : null;
  }

  await row.update(updates);
  return formatTutorialVideoItem(row);
}

async function deleteTutorialVideoItem(id) {
  const row = await getTutorialVideoItemById(id);
  await row.destroy();
}

module.exports = {
  listTutorialVideoItems,
  getTutorialVideoItemById,
  createTutorialVideoItem,
  updateTutorialVideoItem,
  deleteTutorialVideoItem,
  formatTutorialVideoItem
};
