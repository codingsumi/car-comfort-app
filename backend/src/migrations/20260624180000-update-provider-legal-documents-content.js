'use strict';

const { PROVIDER_LEGAL_CATALOG } = require('../constants/providerLegalPages');
const {
  providerContractorLiabilityWaiverHtml,
  providerIndependentContractorAgreementHtml,
  providerPrivacyPolicyHtml,
  providerTermsConditionsHtml
} = require('../seeders/data/providerLegalContentHtml');

const HTML_BY_SLUG = {
  'contractor-liability-waiver': providerContractorLiabilityWaiverHtml,
  'independent-contractor-agreement': providerIndependentContractorAgreementHtml,
  'privacy-policy': providerPrivacyPolicyHtml,
  'terms-conditions': providerTermsConditionsHtml
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('legal_pages')) return;

    for (const item of PROVIDER_LEGAL_CATALOG) {
      const html = HTML_BY_SLUG[item.slug];
      if (!html) continue;

      await queryInterface.sequelize.query(
        `UPDATE legal_pages
         SET title = :title,
             description_json = :description_json,
             meta_title = :meta_title,
             meta_description = :meta_description,
             updated_at = NOW()
         WHERE slug = :slug AND audience = 'provider'`,
        {
          replacements: {
            title: item.title,
            description_json: JSON.stringify({ html }),
            meta_title: `${item.title} | Car Comfort`,
            meta_description: `Car Comfort service provider — ${item.title}.`,
            slug: item.slug
          }
        }
      );
    }
  },

  async down() {
    // Prior legal copy is not restored.
  }
};
