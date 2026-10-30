/**
 * Car Comfort — default legal / support page content for seeders and migrations.
 * America's first on-demand valet EV charging and car wash service.
 *
 * `description_json` is stored as `{ html: string }` for WebView / rich HTML rendering.
 * Each page slug exists per audience: `customer`, `provider`, or `common` (both apps).
 */

const CAR_COMFORT_INTRO =
  "Car Comfort is America's first on-demand valet EV charging and car wash service provider, created to save you time and provide convenience without interrupting your daily schedules. This page applies to the Car Comfort mobile app and related services.";

const PROVIDER_INTRO =
  'These terms apply to Car Comfort service providers (drivers) who accept and perform valet EV charging and car wash jobs through the provider app.';

const customerPrivacyHtml = `<article class="legal-page legal-page--privacy">
<p class="legal-lead">${CAR_COMFORT_INTRO} We are committed to protecting your privacy and handling your personal information responsibly.</p>
<h2>Information we collect</h2>
<p>We may collect account details (name, email, phone), booking and service history, vehicle information needed to perform valet EV charging and car wash services, payment-related data processed by our payment partners, approximate or precise location when you request or receive a service, device and app diagnostics to improve reliability, and communications you send to support.</p>
<h2>How we use your information</h2>
<p>We use this information to schedule and deliver on-demand valet services, match you with providers, process payments, send service updates and notifications you opt into, improve the Car Comfort experience, comply with law, and respond to support requests.</p>
<h2>Sharing and retention</h2>
<p>We share data with service providers and processors who help us run the platform (for example hosting, payments, maps, and notifications) under strict agreements. We do not sell your personal information. We retain information only as long as needed for services, legal obligations, and dispute resolution.</p>
<h2>Your choices and contact</h2>
<p>You may update certain account information in the app, adjust notification preferences where available, and contact us through in-app support or the contact options on our Support page for privacy-related requests, subject to applicable law.</p>
</article>`;

const providerPrivacyHtml = `<article class="legal-page legal-page--privacy legal-page--provider">
<p class="legal-lead">${PROVIDER_INTRO} We collect and use provider information to operate the marketplace safely and pay you for completed services.</p>
<h2>Information we collect</h2>
<p>We may collect identity and contact details, driver license and insurance documentation, vehicle registration information, background check results where permitted, live and historical location while you are online or performing a job, earnings and payout records, device identifiers, in-app communications, and support tickets.</p>
<h2>How we use provider information</h2>
<p>We use this data to verify eligibility, assign bookings, calculate earnings, process payouts through our payment partners, monitor service quality and safety, comply with legal obligations, and respond to disputes or support requests.</p>
<h2>Sharing and retention</h2>
<p>We share limited information with customers as needed to perform a service (for example name and vehicle details during an active booking), and with processors such as payment, mapping, and notification providers under contract. We retain provider records as required for tax, compliance, and dispute resolution.</p>
<h2>Your choices</h2>
<p>You may update profile details in the provider app, manage notification preferences where available, and contact provider support for privacy-related questions subject to applicable law.</p>
</article>`;

const customerWaiverHtml = `<article class="legal-page legal-page--waiver">
<p class="legal-lead">${CAR_COMFORT_INTRO} By using Car Comfort, you acknowledge and agree to the following waiver and release.</p>
<h2>Assumption of risk</h2>
<p>Valet EV charging and car wash services involve handing your vehicle to an independent service provider. You assume the risks inherent in permitting a third party to move, operate, or service your vehicle, subject to applicable law and any separate insurance or claims process described in our Terms &amp; Conditions.</p>
<h2>Release</h2>
<p>To the fullest extent permitted by law, you release Car Comfort and its affiliates from claims arising from ordinary negligence related to platform operations, except where prohibited by law. This does not waive rights that cannot be waived under applicable law.</p>
<h2>Your responsibilities</h2>
<p>You agree to disclose material vehicle conditions, remove valuables, and ensure the vehicle is legally parked and accessible. You remain responsible for personal property left in the vehicle unless otherwise required by law.</p>
</article>`;

const customerTermsHtml = `<article class="legal-page legal-page--terms">
<p class="legal-lead">${CAR_COMFORT_INTRO} By creating an account or booking a service, you agree to these Terms &amp; Conditions and our Privacy Policy.</p>
<h2>Bookings and conduct</h2>
<p>You agree to provide accurate vehicle and location information, follow instructions from valet providers and the app for safe handoff of your vehicle, and use Car Comfort only for lawful purposes. You are responsible for ensuring your vehicle is road-legal and accessible for the booked service. We may refuse or cancel bookings that pose safety, fraud, or abuse risks.</p>
<h2>Payments and changes</h2>
<p>Fees, taxes, and charges are shown before you confirm a booking where applicable. Pricing and service areas may change; we will communicate material changes as required. Third-party payment processors handle card data according to their terms and industry standards.</p>
<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, Car Comfort and its affiliates are not liable for indirect or consequential damages arising from use of the service. Our total liability for claims relating to the service is limited as permitted by law. Some jurisdictions do not allow certain limitations; in those cases, the limitations apply only to the extent permitted.</p>
<h2>Governing law and updates</h2>
<p>These terms are governed by applicable laws in the United States as they relate to your use of Car Comfort. We may update these terms from time to time; continued use after notice constitutes acceptance of the updated terms where permitted by law.</p>
</article>`;

const providerTermsHtml = `<article class="legal-page legal-page--terms legal-page--provider">
<p class="legal-lead">${PROVIDER_INTRO} By registering as a provider and accepting jobs, you agree to these Terms &amp; Conditions and the Provider Privacy Policy.</p>
<h2>Eligibility and independent status</h2>
<p>You represent that you hold a valid driver license, maintain required insurance, and meet all onboarding requirements. Providers are independent contractors, not employees of Car Comfort. You are responsible for taxes, vehicle maintenance, and compliance with local laws.</p>
<h2>Service standards</h2>
<p>You agree to arrive on time, follow in-app workflows for vehicle handoff and service completion, treat customer vehicles with care, and maintain professional conduct. Car Comfort may suspend or deactivate accounts for safety violations, fraud, repeated cancellations, or poor service quality.</p>
<h2>Earnings and payouts</h2>
<p>Earnings, fees, and payout schedules are shown in the provider app and may change with notice where required. Payouts are processed through third-party payment partners subject to their verification and banking rules.</p>
<h2>Liability and updates</h2>
<p>You are responsible for your actions while performing services. Car Comfort’s liability to providers is limited to the fullest extent permitted by law. We may update these terms; continued use of the provider app after notice constitutes acceptance where permitted.</p>
</article>`;

const customerSupportHtml = `<article class="legal-page legal-page--support">
<p class="legal-lead">${CAR_COMFORT_INTRO} If you need help with bookings, payments, your account, or a completed service, our support team is ready to assist.</p>
<h2>How to reach us</h2>
<p>Use the in-app Help or Support section to send a message with your booking details when possible. You can also email our support response inbox (shared separately in app settings and API metadata). Including screenshots or booking IDs helps us resolve issues faster.</p>
<h2>What we can help with</h2>
<ul>
<li>Scheduling or rescheduling valet EV charging and car wash visits</li>
<li>Questions about charges or receipts</li>
<li>Account and notification settings</li>
<li>Feedback on your experience</li>
<li>Reporting safety or service concerns</li>
</ul>
<h2>Response times</h2>
<p>We aim to respond as soon as possible during business hours (U.S. time zones). Complex cases may require additional investigation; we will keep you updated when a resolution is in progress.</p>
</article>`;

const { PROVIDER_LEGAL_CATALOG } = require('../../constants/providerLegalPages');
const {
  providerContractorLiabilityWaiverHtml,
  providerIndependentContractorAgreementHtml,
  providerPrivacyPolicyHtml,
  providerTermsConditionsHtml
} = require('./providerLegalContentHtml');

function providerPlaceholderHtml(title, extraHtml = '') {
  return `<article class="legal-page legal-page--provider legal-page--placeholder">
<p class="legal-lead"><strong>${title}</strong></p>
<p>This document applies to Car Comfort service providers. Full legal text will be published here from the admin panel.</p>
${extraHtml}
<p><em>Car Comfort · 115 Geary Street, San Francisco, California 94108 · 1-800-702-3330</em></p>
</article>`;
}

/** Placeholder HTML for a provider catalog item (used by migrations). */
function getProviderLegalPlaceholderHtml(item) {
  if (item.slug === 'background-check-authorization') {
    return '';
  }
  if (item.slug === 'privacy-policy') {
    return providerPrivacyPolicyHtml;
  }
  if (item.slug === 'terms-conditions') {
    return providerTermsConditionsHtml;
  }
  if (item.slug === 'contractor-liability-waiver') {
    return providerContractorLiabilityWaiverHtml;
  }
  if (item.slug === 'independent-contractor-agreement') {
    return providerIndependentContractorAgreementHtml;
  }
  if (item.slug === 'support') {
    return providerSupportHtml;
  }
  const note = item.source_filename
    ? `<p>Source document: <code>${item.source_filename}</code></p>`
    : '';
  return providerPlaceholderHtml(item.title, note);
}

const providerSupportHtml = `<article class="legal-page legal-page--support legal-page--provider">
<p class="legal-lead">${PROVIDER_INTRO} Use this page for help with onboarding, payouts, active jobs, and account issues.</p>
<h2>How to reach provider support</h2>
<p>Open the in-app Support section from provider settings and include your booking ID or payout reference when available. Email support is also available through the address shown in the app.</p>
<h2>What we can help with</h2>
<ul>
<li>Onboarding, document review, and approval status</li>
<li>Payout timing, missing earnings, or Stripe Connect setup</li>
<li>Issues during an active service or customer handoff</li>
<li>Account deactivation or reinstatement questions</li>
<li>Reporting safety incidents on a job</li>
</ul>
<h2>Response times</h2>
<p>We prioritize active job and payout issues during U.S. business hours. Complex cases may take additional time while we review logs and booking records.</p>
</article>`;

const PAGE_DEFINITIONS = {
  customer: [
    {
      title: 'Terms & Conditions',
      slug: 'terms-conditions',
      description_json: { html: customerTermsHtml },
      meta_title: 'Terms & Conditions | Car Comfort',
      meta_description:
        "Terms of use for Car Comfort — America's first on-demand valet EV charging and car wash app.",
      status: true,
      sort_order: 1,
      requires_agreement: true,
      show_in_menu: true
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      description_json: { html: customerPrivacyHtml },
      meta_title: 'Privacy Policy | Car Comfort',
      meta_description:
        'Learn how Car Comfort protects your data for on-demand valet EV charging and car wash services.',
      status: true,
      sort_order: 2,
      requires_agreement: true,
      show_in_menu: true
    },
    {
      title: 'Waiver',
      slug: 'liability-waiver',
      description_json: { html: customerWaiverHtml },
      meta_title: 'Waiver | Car Comfort',
      meta_description:
        'Customer waiver and release for Car Comfort valet EV charging and car wash services.',
      status: true,
      sort_order: 3,
      requires_agreement: true,
      show_in_menu: true
    },
    {
      title: 'Support',
      slug: 'support',
      description_json: { html: customerSupportHtml },
      meta_title: 'Support | Car Comfort',
      meta_description:
        'Get help with Car Comfort — valet EV charging, car wash bookings, and your account.',
      status: true,
      sort_order: 10,
      requires_agreement: false,
      show_in_menu: true
    }
  ],
  provider: PROVIDER_LEGAL_CATALOG.map((item) => ({
    title: item.title,
    slug: item.slug,
    description_json: { html: getProviderLegalPlaceholderHtml(item) },
    meta_title: `${item.title} | Car Comfort`,
    meta_description: `Car Comfort service provider — ${item.title}.`,
    status: true,
    sort_order: item.sort_order,
    requires_agreement: item.requires_agreement,
    show_in_menu: item.show_in_menu
  }))
};

/**
 * @param {'customer'|'provider'|'all'} [audience='all']
 * @returns {Array<{ title: string, slug: string, audience: string, description_json: { html: string }, meta_title: string, meta_description: string, status: boolean }>}
 */
function getLegalPagesCarComfortRows(audience = 'all') {
  if (audience === 'customer' || audience === 'provider') {
    return PAGE_DEFINITIONS[audience].map((row) => ({ ...row, audience }));
  }
  return [
    ...PAGE_DEFINITIONS.customer.map((row) => ({ ...row, audience: 'customer' })),
    ...PAGE_DEFINITIONS.provider.map((row) => ({ ...row, audience: 'provider' }))
  ];
}

/**
 * Rows formatted for `queryInterface.bulkInsert` (MySQL JSON column).
 * @param {'customer'|'provider'|'all'} [audience='all']
 */
function getLegalPagesCarComfortBulkInsertRows(audience = 'all') {
  const now = new Date();
  return getLegalPagesCarComfortRows(audience).map((row) => ({
    title: row.title,
    slug: row.slug,
    audience: row.audience,
    description_json: JSON.stringify(row.description_json),
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    status: row.status,
    sort_order: row.sort_order ?? 100,
    requires_agreement: Boolean(row.requires_agreement),
    show_in_menu: row.show_in_menu !== false,
    created_at: now,
    updated_at: now
  }));
}

module.exports = {
  CAR_COMFORT_INTRO,
  PROVIDER_INTRO,
  getProviderLegalPlaceholderHtml,
  getLegalPagesCarComfortRows,
  getLegalPagesCarComfortBulkInsertRows
};
