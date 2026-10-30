const { Op, UniqueConstraintError } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const {
  BACKGROUND_CHECK_AUTHORIZATION_SLUG,
  PROVIDER_SIGNUP_REQUIRED_SLUGS,
  PROVIDER_LEGAL_SLUG_SORT
} = require('../constants/providerLegalPages');
const { getSupportContact } = require('./settingsRuntime.service');

const SLUG_MAX = 191;
const DEFAULT_SUPPORT_EMAIL = 'support@carcomfort.com';
const LEGAL_AUDIENCES = ['customer', 'provider', 'common'];
const PUBLIC_LEGAL_AUDIENCES = ['customer', 'provider'];
const DEFAULT_LEGAL_AUDIENCE = 'customer';

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Legacy format: array of { heading, content } → single HTML document.
 * @param {Array<{ heading?: string, content?: string }>} sections
 */
function legacySectionsToHtml(sections) {
  const blocks = sections
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const heading = typeof item.heading === 'string' ? item.heading.trim() : '';
      const content = typeof item.content === 'string' ? item.content.trim() : '';
      if (!heading || !content) return '';
      return `<h2>${escapeHtml(heading)}</h2><p>${escapeHtml(content)}</p>`;
    })
    .filter(Boolean);
  if (!blocks.length) return '';
  return `<article class="legal-page">${blocks.join('\n')}</article>`;
}

/**
 * Normalize DB / API value to `{ html: string }` for responses and persistence.
 * Supports: `{ html }`, legacy `[{ heading, content }, …]`, or JSON string of either.
 * @param {unknown} value
 * @returns {{ html: string }}
 */
function normalizeDescriptionJson(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (_e) {
      const t = value.trim();
      if (t) return { html: t };
      return { html: '' };
    }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.html === 'string') {
    const pdfUrl = typeof parsed.pdf_url === 'string' ? parsed.pdf_url.trim() : '';
    const result = { html: parsed.html };
    if (pdfUrl) result.pdf_url = pdfUrl;
    return result;
  }

  if (Array.isArray(parsed)) {
    return { html: legacySectionsToHtml(parsed) };
  }

  return { html: '' };
}

/**
 * @param {unknown} value
 * @returns {{ html: string }}
 */
function isBackgroundCheckLegalSlug(slug) {
  return normalizeSlugInput(slug) === BACKGROUND_CHECK_AUTHORIZATION_SLUG;
}

/**
 * @param {unknown} value
 * @param {{ slug?: string }} [options]
 */
function coerceDescriptionForSave(value, options = {}) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (_e) {
      parsed = { html: value };
    }
  }
  const normalized = normalizeDescriptionJson(parsed);
  const pdfUrl =
    typeof normalized.pdf_url === 'string' ? normalized.pdf_url.trim() : '';

  if (isBackgroundCheckLegalSlug(options.slug)) {
    if (!pdfUrl) {
      throw new HttpError(400, 'A PDF form is required for background check authorization');
    }
    return { html: '', pdf_url: pdfUrl };
  }

  const trimmed = normalized.html.trim();
  if (!trimmed) throw new HttpError(400, 'description_json must include a non-empty html string');
  const out = { html: trimmed };
  if (pdfUrl) out.pdf_url = pdfUrl;
  return out;
}

function normalizeAudienceInput(raw, { allowCommon = true } = {}) {
  const value = String(raw || DEFAULT_LEGAL_AUDIENCE).trim().toLowerCase();
  const allowed = allowCommon ? LEGAL_AUDIENCES : PUBLIC_LEGAL_AUDIENCES;
  if (!allowed.includes(value)) {
    throw new HttpError(400, `audience must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function normalizePublicAudienceInput(raw) {
  return normalizeAudienceInput(raw, { allowCommon: false });
}

async function resolveSupportEmail() {
  const { supportEmail } = await getSupportContact(db);
  return supportEmail || DEFAULT_SUPPORT_EMAIL;
}

/**
 * Generate a URL-safe slug from a human-readable title.
 * @param {string} title
 */
function slugFromTitle(title) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
  return base || 'page';
}

/**
 * Normalize an explicit slug input (lowercase, safe chars).
 * @param {string} raw
 */
function normalizeSlugInput(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

/**
 * Ensure slug is unique within an audience, appending -2, -3, … if needed.
 * @param {string} baseSlug
 * @param {string} audience
 * @param {bigint|number|undefined} excludeId
 */
async function resolveUniqueSlug(baseSlug, audience, excludeId) {
  let candidate = baseSlug || 'page';
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where = { slug: candidate, audience };
    if (excludeId != null) {
      where.id = { [Op.ne]: excludeId };
    }
    // eslint-disable-next-line no-await-in-loop
    const exists = await db.LegalPage.findOne({ where, attributes: ['id'] });
    if (!exists) return candidate;
    const stem = baseSlug || 'page';
    candidate = `${stem}-${suffix}`.slice(0, SLUG_MAX);
    suffix += 1;
    if (suffix > 10_000) throw new HttpError(500, 'Could not allocate a unique slug');
  }
}

async function mapPublicRow(row) {
  const description_json = normalizeDescriptionJson(row.description_json);
  const supportEmail = row.slug === 'support' ? await resolveSupportEmail() : null;
  if (supportEmail) description_json.support_email = supportEmail;
  return {
    title: row.title,
    slug: row.slug,
    audience: row.audience,
    description_json,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
    sort_order: row.sort_order ?? 100,
    requires_agreement: Boolean(row.requires_agreement),
    show_in_menu: row.show_in_menu !== false
  };
}

async function mapAdminRow(row) {
  const description_json = normalizeDescriptionJson(row.description_json);
  const supportEmail = row.slug === 'support' ? await resolveSupportEmail() : null;
  if (supportEmail) description_json.support_email = supportEmail;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    audience: row.audience,
    description_json,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
    status: Boolean(row.status),
    sort_order: row.sort_order ?? 100,
    requires_agreement: Boolean(row.requires_agreement),
    show_in_menu: row.show_in_menu !== false,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}

function resolveSortOrder(row, audience) {
  if (row.sort_order != null && !Number.isNaN(Number(row.sort_order))) {
    return Number(row.sort_order);
  }
  if (audience === 'provider' && PROVIDER_LEGAL_SLUG_SORT[row.slug] != null) {
    return PROVIDER_LEGAL_SLUG_SORT[row.slug];
  }
  return LEGAL_PAGE_SLUG_SORT[row.slug] ?? 100;
}

function sortLegalPageRows(rows, audience) {
  return rows.sort((a, b) => {
    const ao = resolveSortOrder(a, audience);
    const bo = resolveSortOrder(b, audience);
    if (ao !== bo) return ao - bo;
    return String(a.title).localeCompare(String(b.title));
  });
}

const LEGAL_PAGE_SLUG_SORT = {
  'terms-conditions': 1,
  'privacy-policy': 2,
  'liability-waiver': 3,
  support: 10
};

/** Only these slugs may reuse customer content when no provider page exists (not waiver, etc.). */
const PROVIDER_CUSTOMER_FALLBACK_SLUGS = new Set(Object.keys(LEGAL_PAGE_SLUG_SORT));

function canUseProviderCustomerFallback(slug) {
  return PROVIDER_CUSTOMER_FALLBACK_SLUGS.has(slug);
}

/**
 * Merge active pages for a public app audience: role-specific, then common, then provider core fallbacks.
 * @param {'customer'|'provider'} normalizedAudience
 */
async function mergeActiveLegalPagesForPublicAudience(normalizedAudience) {
  const audienceRows = await db.LegalPage.findAll({
    where: { audience: normalizedAudience, status: true }
  });

  /** @type {Map<string, import('../models').LegalPage>} */
  const bySlug = new Map(audienceRows.map((row) => [row.slug, row]));

  const commonRows = await db.LegalPage.findAll({
    where: { audience: 'common', status: true }
  });
  for (const row of commonRows) {
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
  }

  if (normalizedAudience === 'provider') {
    const customerRows = await db.LegalPage.findAll({
      where: { audience: 'customer', status: true }
    });
    for (const row of customerRows) {
      if (!bySlug.has(row.slug) && canUseProviderCustomerFallback(row.slug)) {
        bySlug.set(row.slug, row);
      }
    }
  }

  return bySlug;
}

/**
 * Public: active legal page by slug and audience (404 if missing or inactive).
 * Resolution order: role page → common → (provider only) core customer fallback.
 * @param {string} slug
 * @param {string} [audience]
 */
async function getActiveLegalPageBySlug(slug, audience = DEFAULT_LEGAL_AUDIENCE) {
  const normalized = normalizeSlugInput(slug);
  if (!normalized) throw new HttpError(400, 'Invalid page slug');

  const normalizedAudience = normalizePublicAudienceInput(audience);

  let row = await db.LegalPage.findOne({
    where: { slug: normalized, audience: normalizedAudience, status: true }
  });

  if (!row) {
    row = await db.LegalPage.findOne({
      where: { slug: normalized, audience: 'common', status: true }
    });
  }

  if (!row && normalizedAudience === 'provider' && canUseProviderCustomerFallback(normalized)) {
    row = await db.LegalPage.findOne({
      where: { slug: normalized, audience: 'customer', status: true }
    });
  }

  if (!row) throw new HttpError(404, 'Legal page not found');

  return mapPublicRow(row);
}

/**
 * Public: all active legal pages for an audience (menu + content).
 * Includes common pages for both apps; customer-only pages (e.g. waiver) stay customer-only.
 * @param {string} [audience]
 */
async function listActiveLegalPagesForAudience(audience = DEFAULT_LEGAL_AUDIENCE) {
  const normalizedAudience = normalizePublicAudienceInput(audience);
  const bySlug = await mergeActiveLegalPagesForPublicAudience(normalizedAudience);
  let merged = Array.from(bySlug.values());
  merged = sortLegalPageRows(merged, normalizedAudience);

  if (normalizedAudience === 'provider') {
    merged = merged.filter((row) => row.show_in_menu !== false);
  }

  const publicRows = await Promise.all(merged.map(mapPublicRow));
  const signupRequired = publicRows.filter((row) => row.requires_agreement);

  return {
    audience: normalizedAudience,
    legal_pages: publicRows,
    signup_required: signupRequired.map((row) => ({
      slug: row.slug,
      title: row.title,
      requires_agreement: true
    })),
    signup_required_slugs:
      normalizedAudience === 'provider' ? [...PROVIDER_SIGNUP_REQUIRED_SLUGS] : undefined
  };
}

/**
 * Admin listing with pagination and optional search (title or slug) and status filter.
 * @param {{ page: number, limit: number, search?: string, status?: 'all'|'true'|'false', audience?: string }} params
 */
async function listLegalPagesAdmin(params) {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const offset = (page - 1) * limit;

  /** @type {import('sequelize').WhereOptions} */
  const where = {};

  if (params.audience) {
    where.audience = normalizeAudienceInput(params.audience);
  }

  if (params.search && String(params.search).trim()) {
    const q = `%${String(params.search).trim()}%`;
    where[Op.or] = [{ title: { [Op.like]: q } }, { slug: { [Op.like]: q } }];
  }

  if (params.status === 'true') where.status = true;
  else if (params.status === 'false') where.status = false;

  const { count, rows } = await db.LegalPage.findAndCountAll({
    where,
    order: [
      ['sort_order', 'ASC'],
      ['title', 'ASC'],
      ['id', 'ASC']
    ],
    limit,
    offset
  });

  return {
    legal_pages: await Promise.all(rows.map(mapAdminRow)),
    pagination: {
      total: count,
      page,
      limit,
      total_pages: Math.ceil(count / limit) || 0
    }
  };
}

/**
 * @param {bigint|number|string} id
 */
async function getLegalPageByIdForAdmin(id) {
  const row = await db.LegalPage.findByPk(id);
  if (!row) throw new HttpError(404, 'Legal page not found');
  return mapAdminRow(row);
}

/**
 * @param {{
 *   title: string,
 *   slug?: string|null,
 *   description_json: unknown,
 *   meta_title?: string|null,
 *   meta_description?: string|null,
 *   status?: boolean,
 *   audience?: string
 * }} input
 */
async function nextSortOrderForAudience(audience) {
  const max = await db.LegalPage.max('sort_order', { where: { audience } });
  const n = max != null ? Number(max) : 0;
  return (Number.isFinite(n) ? n : 0) + 1;
}

async function createLegalPage(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new HttpError(400, 'title is required');

  const audience = normalizeAudienceInput(input.audience);

  let baseSlug = input.slug != null && String(input.slug).trim()
    ? normalizeSlugInput(input.slug)
    : slugFromTitle(title);
  if (!baseSlug) baseSlug = 'page';

  const slug = await resolveUniqueSlug(baseSlug, audience, undefined);
  const description_json = coerceDescriptionForSave(input.description_json, { slug });
  const sortOrder =
    input.sort_order != null ? Number(input.sort_order) : await nextSortOrderForAudience(audience);

  try {
    const row = await db.LegalPage.create({
      title,
      slug,
      audience,
      description_json,
      meta_title: input.meta_title != null ? String(input.meta_title).trim() || null : null,
      meta_description:
        input.meta_description != null ? String(input.meta_description).trim() || null : null,
      status: input.status !== undefined ? Boolean(input.status) : true,
      sort_order: sortOrder,
      requires_agreement: input.requires_agreement !== undefined ? Boolean(input.requires_agreement) : false,
      show_in_menu: input.show_in_menu !== undefined ? Boolean(input.show_in_menu) : true
    });
    return mapAdminRow(row);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, 'Slug already exists');
    }
    throw err;
  }
}

/**
 * @param {bigint|number|string} id
 * @param {Partial<{
 *   title: string,
 *   slug: string|null,
 *   description_json: unknown,
 *   meta_title: string|null,
 *   meta_description: string|null,
 *   status: boolean,
 *   audience: string
 * }>} input
 */
async function updateLegalPage(id, input) {
  const row = await db.LegalPage.findByPk(id);
  if (!row) throw new HttpError(404, 'Legal page not found');

  const patch = {};
  const audienceForSlug = input.audience !== undefined
    ? normalizeAudienceInput(input.audience)
    : row.audience;

  if (input.audience !== undefined) {
    patch.audience = audienceForSlug;
  }

  if (input.title !== undefined) {
    const title = String(input.title || '').trim();
    if (!title) throw new HttpError(400, 'title cannot be empty');
    patch.title = title;
  }

  if (input.description_json !== undefined) {
    let effectiveSlug = row.slug;
    if (input.slug !== undefined && input.slug !== null) {
      const raw = String(input.slug).trim();
      effectiveSlug = raw ? normalizeSlugInput(raw) : slugFromTitle(patch.title ?? row.title);
    }
    patch.description_json = coerceDescriptionForSave(input.description_json, {
      slug: effectiveSlug
    });
  }

  if (input.meta_title !== undefined) {
    patch.meta_title = input.meta_title == null ? null : String(input.meta_title).trim() || null;
  }
  if (input.meta_description !== undefined) {
    patch.meta_description =
      input.meta_description == null ? null : String(input.meta_description).trim() || null;
  }
  if (input.status !== undefined) {
    patch.status = Boolean(input.status);
  }
  if (input.sort_order !== undefined) {
    patch.sort_order = Number(input.sort_order);
  }
  if (input.requires_agreement !== undefined) {
    patch.requires_agreement = Boolean(input.requires_agreement);
  }
  if (input.show_in_menu !== undefined) {
    patch.show_in_menu = Boolean(input.show_in_menu);
  }

  if (input.slug !== undefined && input.slug !== null) {
    const raw = String(input.slug).trim();
    const titleForSlug = patch.title !== undefined ? patch.title : row.title;
    const baseSlug = raw ? normalizeSlugInput(raw) : slugFromTitle(titleForSlug);
    patch.slug = await resolveUniqueSlug(baseSlug || 'page', audienceForSlug, row.id);
  } else if (input.audience !== undefined && audienceForSlug !== row.audience) {
    patch.slug = await resolveUniqueSlug(row.slug, audienceForSlug, row.id);
    if (input.sort_order === undefined) {
      patch.sort_order = await nextSortOrderForAudience(audienceForSlug);
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, 'No valid fields to update');
  }

  try {
    await row.update(patch);
    await row.reload();
    return mapAdminRow(row);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, 'Slug already exists');
    }
    throw err;
  }
}

/**
 * @param {bigint|number|string} id
 */
async function deleteLegalPage(id) {
  const row = await db.LegalPage.findByPk(id);
  if (!row) throw new HttpError(404, 'Legal page not found');
  await row.destroy();
}

/**
 * Set display order for all pages in an audience (admin drag / up-down).
 * @param {string} audience
 * @param {number[]} orderedIds
 */
async function reorderLegalPages(audience, orderedIds) {
  const normalizedAudience = normalizeAudienceInput(audience);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new HttpError(400, 'ordered_ids array is required');
  }

  const ids = orderedIds.map((id) => Number(id));
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new HttpError(400, 'ordered_ids must be positive integers');
  }

  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new HttpError(400, 'ordered_ids must not contain duplicates');
  }

  const rows = await db.LegalPage.findAll({
    where: { id: { [Op.in]: ids }, audience: normalizedAudience },
    attributes: ['id']
  });
  if (rows.length !== ids.length) {
    throw new HttpError(400, 'All pages must belong to the specified audience');
  }

  const t = await db.sequelize.transaction();
  try {
    for (let i = 0; i < ids.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await db.LegalPage.update({ sort_order: i + 1 }, { where: { id: ids[i] }, transaction: t });
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  return { updated: ids.length, audience: normalizedAudience };
}

module.exports = {
  LEGAL_AUDIENCES,
  PUBLIC_LEGAL_AUDIENCES,
  DEFAULT_LEGAL_AUDIENCE,
  normalizeDescriptionJson,
  normalizeAudienceInput,
  normalizePublicAudienceInput,
  slugFromTitle,
  normalizeSlugInput,
  getActiveLegalPageBySlug,
  listActiveLegalPagesForAudience,
  listLegalPagesAdmin,
  getLegalPageByIdForAdmin,
  createLegalPage,
  updateLegalPage,
  deleteLegalPage,
  reorderLegalPages
};
