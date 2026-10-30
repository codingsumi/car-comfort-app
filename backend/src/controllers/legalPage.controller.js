const { getActiveLegalPageBySlug, listActiveLegalPagesForAudience } = require('../services/legalPage.service');
const { rewriteUnreachableMediaHost } = require('../utils/fileUpload');

function rewriteLegalPageMediaUrls(row, req) {
  if (!row || typeof row !== 'object') return row;
  const desc = row.description_json;
  if (!desc || typeof desc !== 'object') return row;

  const pdfUrl = typeof desc.pdf_url === 'string' ? desc.pdf_url.trim() : '';
  if (!pdfUrl) return row;

  return {
    ...row,
    description_json: {
      ...desc,
      pdf_url: rewriteUnreachableMediaHost(req, pdfUrl)
    }
  };
}

/**
 * Public API: fetch a single active legal/support page by slug.
 * Query: `page` — slug value (e.g. privacy-policy).
 *
 * Response `data.description_json` shape: `{ html: string }` — full page body HTML for WebView or `dangerouslySetInnerHTML`.
 *
 * @example GET /api/legal-page?page=privacy-policy
 */
async function getLegalPage(req, res, next) {
  try {
    const slug = req.query.page;
    const audience = req.query.audience;
    const data = await getActiveLegalPageBySlug(slug, audience);
    return res.success('Legal page fetched', rewriteLegalPageMediaUrls(data, req));
  } catch (err) {
    return next(err);
  }
}

/**
 * Public API: list all active legal pages for an audience (menu + HTML content).
 * Query: `audience` — optional `customer` (default) or `provider`.
 *
 * Provider response also includes `signup_required` (pages with requires_agreement)
 * and `signup_required_slugs` for the registration flow.
 *
 * @example GET /api/legal-pages?audience=provider
 */
async function listLegalPages(req, res, next) {
  try {
    const audience = req.query.audience;
    const data = await listActiveLegalPagesForAudience(audience);
    return res.success('Legal pages fetched', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLegalPage,
  listLegalPages
};
