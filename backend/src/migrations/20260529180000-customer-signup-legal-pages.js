'use strict';

const { QueryTypes } = require('sequelize');
const { CUSTOMER_LEGAL_CATALOG } = require('../constants/customerLegalPages');
const { getLegalPagesCarComfortRows } = require('../seeders/data/legalPagesCarComfort');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const seedBySlug = new Map(
      getLegalPagesCarComfortRows('customer').map((row) => [row.slug, row])
    );

    const now = new Date();

    for (const item of CUSTOMER_LEGAL_CATALOG) {
      const seed = seedBySlug.get(item.slug);
      const html = seed?.description_json?.html ?? `<p>${item.title}</p>`;

      const existing = await queryInterface.sequelize.query(
        'SELECT id FROM legal_pages WHERE slug = :slug AND audience = :audience LIMIT 1',
        {
          replacements: { slug: item.slug, audience: 'customer' },
          type: QueryTypes.SELECT
        }
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('legal_pages', [
          {
            title: item.title,
            slug: item.slug,
            audience: 'customer',
            description_json: JSON.stringify({ html }),
            meta_title: seed?.meta_title ?? `${item.title} | Car Comfort`,
            meta_description: seed?.meta_description ?? `Car Comfort — ${item.title}.`,
            status: true,
            sort_order: item.sort_order,
            requires_agreement: item.requires_agreement ? 1 : 0,
            show_in_menu: item.show_in_menu ? 1 : 0,
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

    await queryInterface.sequelize.query(
      `DELETE FROM legal_pages WHERE audience = 'customer' AND slug = 'liability-waiver'`
    );

    await queryInterface.sequelize.query(
      `UPDATE legal_pages
       SET requires_agreement = 0
       WHERE audience = 'customer' AND slug IN ('privacy-policy', 'terms-conditions')`
    );
  }
};
