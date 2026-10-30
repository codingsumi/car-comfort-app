const {
  listLegalPagesAdmin,
  getLegalPageByIdForAdmin,
  createLegalPage,
  updateLegalPage,
  deleteLegalPage,
  reorderLegalPages
} = require('../../services/legalPage.service');
const { HttpError } = require('../../utils/httpError');

/**
 * List legal pages (admin). Supports pagination, search on title/slug, optional status filter.
 *
 * @example GET /api/admin/legal-pages?page=1&limit=10&search=privacy&status=all
 */
async function listLegalPages(req, res, next) {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const limit = req.query.limit != null ? Number(req.query.limit) : 10;
    const search = req.query.search;
    const status = req.query.status != null ? String(req.query.status) : 'all';
    const audience = req.query.audience;

    const data = await listLegalPagesAdmin({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 10,
      search: typeof search === 'string' ? search : undefined,
      status,
      audience: typeof audience === 'string' ? audience : undefined
    });
    return res.success('Legal pages fetched', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * @example GET /api/admin/legal-pages/:id
 */
async function getLegalPage(req, res, next) {
  try {
    const data = await getLegalPageByIdForAdmin(req.params.id);
    return res.success('Legal page fetched', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * Create a legal page. Slug is derived from title when omitted; ensured unique.
 * Body `description_json`: `{ "html": "<article>...</article>" }` or PDF-only for background check.
 *
 * @example POST /api/admin/legal-pages
 */
async function createLegalPageHandler(req, res, next) {
  try {
    const data = await createLegalPage({
      title: req.body.title,
      slug: req.body.slug,
      description_json: req.body.description_json,
      meta_title: req.body.meta_title,
      meta_description: req.body.meta_description,
      status: req.body.status,
      audience: req.body.audience,
      sort_order: req.body.sort_order,
      requires_agreement: req.body.requires_agreement,
      show_in_menu: req.body.show_in_menu
    });
    return res.success('Legal page created', data, 201);
  } catch (err) {
    return next(err);
  }
}

/**
 * @example PATCH /api/admin/legal-pages/:id
 */
async function updateLegalPageHandler(req, res, next) {
  try {
    const data = await updateLegalPage(req.params.id, {
      title: req.body.title,
      slug: req.body.slug,
      description_json: req.body.description_json,
      meta_title: req.body.meta_title,
      meta_description: req.body.meta_description,
      status: req.body.status,
      audience: req.body.audience,
      sort_order: req.body.sort_order,
      requires_agreement: req.body.requires_agreement,
      show_in_menu: req.body.show_in_menu
    });
    return res.success('Legal page updated', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * @example DELETE /api/admin/legal-pages/:id
 */
async function deleteLegalPageHandler(req, res, next) {
  try {
    await deleteLegalPage(req.params.id);
    return res.success('Legal page deleted');
  } catch (err) {
    return next(err);
  }
}

/**
 * @example PATCH /api/admin/legal-pages/reorder
 * Body: { "audience": "customer", "ordered_ids": [3, 1, 2] }
 */
async function reorderLegalPagesHandler(req, res, next) {
  try {
    const data = await reorderLegalPages(req.body.audience, req.body.ordered_ids);
    return res.success('Legal pages reordered', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * Upload blank background-check PDF for provider onboarding step 5.
 *
 * @example POST /api/admin/legal-pages/upload-pdf
 */
async function uploadLegalPagePdf(req, res, next) {
  try {
    if (!req.file) throw new HttpError(400, 'No PDF file uploaded');

    const isPdf =
      req.file.mimetype === 'application/pdf' ||
      String(req.file.originalname || '')
        .toLowerCase()
        .endsWith('.pdf');
    if (!isPdf) throw new HttpError(400, 'Only PDF files are allowed');

    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4001}`;
    const uploadBase = process.env.UPLOAD_PUBLIC_BASE || '/uploads';
    const filePath = `${baseUrl}${uploadBase}/legal/${req.file.filename}`;

    return res.success('PDF uploaded successfully', {
      url: filePath,
      filename: req.file.filename
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listLegalPages,
  getLegalPage,
  createLegalPageHandler,
  updateLegalPageHandler,
  deleteLegalPageHandler,
  reorderLegalPagesHandler,
  uploadLegalPagePdf
};
