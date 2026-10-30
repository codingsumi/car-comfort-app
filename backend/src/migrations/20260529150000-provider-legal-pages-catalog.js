'use strict';

const { QueryTypes } = require('sequelize');
const { PROVIDER_LEGAL_CATALOG } = require('../constants/providerLegalPages');
const { getProviderLegalPlaceholderHtml } = require('../seeders/data/legalPagesCarComfort');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const table = await queryInterface.describeTable('legal_pages');

    if (!table.sort_order) {
      await queryInterface.addColumn('legal_pages', 'sort_order', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100,
        after: 'status'
      });
    }

    if (!table.requires_agreement) {
      await queryInterface.addColumn('legal_pages', 'requires_agreement', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'sort_order'
      });
    }

    if (!table.show_in_menu) {
      await queryInterface.addColumn('legal_pages', 'show_in_menu', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        after: 'requires_agreement'
      });
    }

    const now = new Date();

    for (const item of PROVIDER_LEGAL_CATALOG) {
      const existing = await queryInterface.sequelize.query(
        'SELECT id, description_json FROM legal_pages WHERE slug = :slug AND audience = :audience LIMIT 1',
        {
          replacements: { slug: item.slug, audience: 'provider' },
          type: QueryTypes.SELECT
        }
      );

      if (existing.length === 0) {
        const html = getProviderLegalPlaceholderHtml(item);
        await queryInterface.bulkInsert('legal_pages', [
          {
            title: item.title,
            slug: item.slug,
            audience: 'provider',
            description_json: JSON.stringify({ html }),
            meta_title: `${item.title} | Car Comfort`,
            meta_description: `Car Comfort service provider — ${item.title}.`,
            status: true,
            sort_order: item.sort_order,
            requires_agreement: item.requires_agreement,
            show_in_menu: item.show_in_menu,
            created_at: now,
            updated_at: now
          }
        ]);
        continue;
      }

      await queryInterface.sequelize.query(
        `UPDATE legal_pages
         SET title = :title,
             sort_order = :sort_order,
             requires_agreement = :requires_agreement,
             show_in_menu = :show_in_menu,
             updated_at = :updated_at
         WHERE id = :id`,
        {
          replacements: {
            id: existing[0].id,
            title: item.title,
            sort_order: item.sort_order,
            requires_agreement: item.requires_agreement ? 1 : 0,
            show_in_menu: item.show_in_menu ? 1 : 0,
            updated_at: now
          }
        }
      );
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const newSlugs = [
      'provider-nda',
      'independent-contractor-agreement',
      'contractor-liability-waiver',
      'vehicle-user-agreement',
      'background-check-authorization'
    ];

    await queryInterface.bulkDelete('legal_pages', {
      audience: 'provider',
      slug: newSlugs
    });

    const table = await queryInterface.describeTable('legal_pages');
    if (table.show_in_menu) await queryInterface.removeColumn('legal_pages', 'show_in_menu');
    if (table.requires_agreement) await queryInterface.removeColumn('legal_pages', 'requires_agreement');
    if (table.sort_order) await queryInterface.removeColumn('legal_pages', 'sort_order');
  }
};
