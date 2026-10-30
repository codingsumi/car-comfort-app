const { body, query, param } = require('express-validator');

const db = require('../models');
const { BACKGROUND_CHECK_AUTHORIZATION_SLUG } = require('../constants/providerLegalPages');

const HTML_MAX_LEN = 500_000;
const PDF_URL_MAX_LEN = 2048;

function normalizeSlugForValidation(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 191);
}

function isBackgroundCheckSlug(slug) {
  return normalizeSlugForValidation(slug) === BACKGROUND_CHECK_AUTHORIZATION_SLUG;
}

async function resolveSlugForDescriptionValidation(req) {
  const fromBody = normalizeSlugForValidation(req.body?.slug);
  if (fromBody) return fromBody;
  if (req.params?.id) {
    const row = await db.LegalPage.findByPk(req.params.id, { attributes: ['slug'] });
    if (row?.slug) return row.slug;
  }
  const fromTitle = String(req.body?.title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return fromTitle;
}

function validateStandardDescriptionJson(obj) {
  if (obj == null || typeof obj !== 'object') {
    throw new Error('description_json must be an object');
  }
  if (typeof obj.html !== 'string') {
    throw new Error('description_json must include an html string property');
  }
  if (!obj.html.trim()) {
    throw new Error('description_json.html must not be empty');
  }
  if (obj.html.length > HTML_MAX_LEN) {
    throw new Error(`description_json.html must be at most ${HTML_MAX_LEN} characters`);
  }
  if (obj.pdf_url != null) {
    const pdf = String(obj.pdf_url).trim();
    if (pdf.length > PDF_URL_MAX_LEN) {
      throw new Error(`description_json.pdf_url must be at most ${PDF_URL_MAX_LEN} characters`);
    }
  }
}

function validateBackgroundCheckDescriptionJson(obj) {
  if (obj == null || typeof obj !== 'object') {
    throw new Error('description_json must be an object');
  }
  const pdf = typeof obj.pdf_url === 'string' ? obj.pdf_url.trim() : '';
  if (!pdf) {
    throw new Error('description_json.pdf_url is required for background check authorization');
  }
  if (pdf.length > PDF_URL_MAX_LEN) {
    throw new Error(`description_json.pdf_url must be at most ${PDF_URL_MAX_LEN} characters`);
  }
  if (obj.html != null && typeof obj.html !== 'string') {
    throw new Error('description_json.html must be a string when provided');
  }
  if (obj.html && obj.html.length > HTML_MAX_LEN) {
    throw new Error(`description_json.html must be at most ${HTML_MAX_LEN} characters`);
  }
}

const descriptionJsonCreateValidator = body('description_json')
  .isObject()
  .withMessage('description_json must be an object')
  .custom(async (obj, { req }) => {
    const slug = await resolveSlugForDescriptionValidation(req);
    if (isBackgroundCheckSlug(slug)) {
      validateBackgroundCheckDescriptionJson(obj);
    } else {
      validateStandardDescriptionJson(obj);
    }
    return true;
  });

const descriptionJsonUpdateValidator = body('description_json')
  .optional()
  .isObject()
  .withMessage('description_json must be an object when provided')
  .custom(async (obj, { req }) => {
    const slug = await resolveSlugForDescriptionValidation(req);
    if (isBackgroundCheckSlug(slug)) {
      validateBackgroundCheckDescriptionJson(obj);
    } else {
      validateStandardDescriptionJson(obj);
    }
    return true;
  });

/**
 * Public: `page` query holds the slug (e.g. privacy-policy).
 */
const publicLegalPageQueryValidator = [
  query('page')
    .trim()
    .notEmpty()
    .withMessage('page (slug) is required')
    .isLength({ min: 1, max: 191 })
    .withMessage('page must be at most 191 characters'),
  query('audience')
    .optional()
    .trim()
    .isIn(['customer', 'provider'])
    .withMessage('audience must be customer or provider')
];

const publicLegalPagesListQueryValidator = [
  query('audience')
    .optional()
    .trim()
    .isIn(['customer', 'provider'])
    .withMessage('audience must be customer or provider')
];

const createLegalPageValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 255 })
    .withMessage('title must be at most 255 characters'),
  body('slug')
    .optional({ nullable: true })
    .isString()
    .withMessage('slug must be a string')
    .trim()
    .isLength({ max: 191 })
    .withMessage('slug must be at most 191 characters'),
  descriptionJsonCreateValidator,
  body('meta_title')
    .optional({ nullable: true })
    .isString()
    .withMessage('meta_title must be a string')
    .isLength({ max: 255 })
    .withMessage('meta_title must be at most 255 characters'),
  body('meta_description')
    .optional({ nullable: true })
    .isString()
    .withMessage('meta_description must be a string')
    .isLength({ max: 512 })
    .withMessage('meta_description must be at most 512 characters'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
  body('sort_order')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('sort_order must be between 0 and 9999')
    .toInt(),
  body('requires_agreement').optional().isBoolean().withMessage('requires_agreement must be a boolean'),
  body('show_in_menu').optional().isBoolean().withMessage('show_in_menu must be a boolean'),
  body('audience')
    .optional()
    .trim()
    .isIn(['customer', 'provider', 'common'])
    .withMessage('audience must be customer, provider, or common')
];

const updateLegalPageValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer')
    .toInt(),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('title cannot be empty')
    .isLength({ max: 255 })
    .withMessage('title must be at most 255 characters'),
  body('slug')
    .optional({ nullable: true })
    .isString()
    .withMessage('slug must be a string')
    .trim()
    .isLength({ max: 191 })
    .withMessage('slug must be at most 191 characters'),
  descriptionJsonUpdateValidator,
  body('meta_title')
    .optional({ nullable: true })
    .isString()
    .withMessage('meta_title must be a string')
    .isLength({ max: 255 })
    .withMessage('meta_title must be at most 255 characters'),
  body('meta_description')
    .optional({ nullable: true })
    .isString()
    .withMessage('meta_description must be a string')
    .isLength({ max: 512 })
    .withMessage('meta_description must be at most 512 characters'),
  body('status').optional().isBoolean().withMessage('status must be a boolean'),
  body('sort_order')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('sort_order must be between 0 and 9999')
    .toInt(),
  body('requires_agreement').optional().isBoolean().withMessage('requires_agreement must be a boolean'),
  body('show_in_menu').optional().isBoolean().withMessage('show_in_menu must be a boolean'),
  body('audience')
    .optional()
    .trim()
    .isIn(['customer', 'provider', 'common'])
    .withMessage('audience must be customer, provider, or common')
];

const listLegalPagesQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string')
    .isLength({ max: 255 })
    .withMessage('search is too long'),
  query('status')
    .optional()
    .isIn(['all', 'true', 'false'])
    .withMessage("status must be one of: all, true, false"),
  query('audience')
    .optional()
    .trim()
    .isIn(['customer', 'provider', 'common'])
    .withMessage('audience must be customer, provider, or common')
];

const legalPageIdParamValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer')
    .toInt()
];

const reorderLegalPagesValidator = [
  body('audience')
    .trim()
    .notEmpty()
    .withMessage('audience is required')
    .isIn(['customer', 'provider', 'common'])
    .withMessage('audience must be customer, provider, or common'),
  body('ordered_ids')
    .isArray({ min: 1 })
    .withMessage('ordered_ids must be a non-empty array'),
  body('ordered_ids.*')
    .isInt({ min: 1 })
    .withMessage('each ordered_ids entry must be a positive integer')
    .toInt()
];

module.exports = {
  HTML_MAX_LEN,
  publicLegalPageQueryValidator,
  publicLegalPagesListQueryValidator,
  createLegalPageValidator,
  updateLegalPageValidator,
  listLegalPagesQueryValidator,
  legalPageIdParamValidator,
  reorderLegalPagesValidator
};
