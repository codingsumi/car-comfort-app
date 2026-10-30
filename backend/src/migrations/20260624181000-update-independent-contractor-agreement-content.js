'use strict';

const { PROVIDER_LEGAL_CATALOG } = require('../constants/providerLegalPages');
const { providerIndependentContractorAgreementHtml } = require('../seeders/data/providerLegalContentHtml');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('legal_pages')) return;

    const item = PROVIDER_LEGAL_CATALOG.find((row) => row.slug === 'independent-contractor-agreement');
    if (!item) return;

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
          description_json: JSON.stringify({ html: providerIndependentContractorAgreementHtml }),
          meta_title: `${item.title} | Car Comfort`,
          meta_description: `Car Comfort service provider — ${item.title}.`,
          slug: item.slug
        }
      }
    );
  },

  async down() {
    // Prior legal copy is not restored.
  }
};
