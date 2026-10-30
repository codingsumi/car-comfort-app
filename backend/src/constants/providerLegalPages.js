/**
 * Provider (service provider / driver) legal document catalog.
 * Matches client deliverables — content is managed via admin Legal Pages (audience: provider).
 *
 * Signup flow: app lists `signup_required` pages; user must open each document and accept before registering.
 * Settings menu: all pages with `show_in_menu: true` remain available for review anytime.
 */

/** Slug used for onboarding step 5 (background check consent) — links to this legal page. */
const BACKGROUND_CHECK_AUTHORIZATION_SLUG = 'background-check-authorization';

/**
 * Ordered provider documents required at signup (must agree before completing registration).
 * @type {readonly string[]}
 */
/** Completed on onboarding step 5 (download, e-sign, upload) — not at account register. */
const PROVIDER_SIGNUP_REQUIRED_SLUGS = Object.freeze([
  'provider-nda',
  'independent-contractor-agreement',
  'privacy-policy',
  'contractor-liability-waiver',
  'vehicle-user-agreement',
  'terms-conditions'
]);

/**
 * @type {readonly ProviderLegalCatalogItem[]}
 */
const PROVIDER_LEGAL_CATALOG = Object.freeze([
  {
    slug: 'provider-nda',
    title: 'Service Provider NDA',
    sort_order: 10,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Service providers NDA.docx'
  },
  {
    slug: 'independent-contractor-agreement',
    title: 'Independent Contractor Agreement',
    sort_order: 20,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Independent Contractor Agreement.docx'
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    sort_order: 30,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Privacy Policy.docx'
  },
  {
    slug: 'contractor-liability-waiver',
    title: 'Independent Contractor Liability Waiver',
    sort_order: 40,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Independent Contractor Liability Waiver.docx'
  },
  {
    slug: 'vehicle-user-agreement',
    title: 'Vehicle User Agreement',
    sort_order: 50,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Vehicle User Agreement.docx'
  },
  {
    slug: 'terms-conditions',
    title: 'Service Provider Terms and Conditions',
    sort_order: 60,
    requires_agreement: true,
    show_in_menu: true,
    source_filename: 'Service providers terms and conditions.docx'
  },
  {
    slug: BACKGROUND_CHECK_AUTHORIZATION_SLUG,
    title: 'Background Check Authorization Form',
    sort_order: 70,
    requires_agreement: false,
    show_in_menu: true,
    source_filename: 'Background-Check-Authorization-Form.pdf',
    supports_esign: true,
    onboarding_step: 5
  },
  {
    slug: 'support',
    title: 'Provider Support',
    sort_order: 200,
    requires_agreement: false,
    show_in_menu: true,
    source_filename: null
  }
]);

const PROVIDER_LEGAL_SLUG_SORT = Object.fromEntries(
  PROVIDER_LEGAL_CATALOG.map((item) => [item.slug, item.sort_order])
);

module.exports = {
  BACKGROUND_CHECK_AUTHORIZATION_SLUG,
  PROVIDER_SIGNUP_REQUIRED_SLUGS,
  PROVIDER_LEGAL_CATALOG,
  PROVIDER_LEGAL_SLUG_SORT
};
