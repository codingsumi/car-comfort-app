'use strict';

const { getLegalPagesCarComfortBulkInsertRows } = require('../seeders/data/legalPagesCarComfort');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const table = await queryInterface.describeTable('legal_pages');
    if (!table.audience) {
      await queryInterface.addColumn('legal_pages', 'audience', {
        type: Sequelize.ENUM('customer', 'provider'),
        allowNull: false,
        defaultValue: 'customer',
        after: 'slug'
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE legal_pages SET audience = 'customer' WHERE audience IS NULL OR audience = ''"
    );

    try {
      await queryInterface.removeIndex('legal_pages', 'slug');
    } catch (_e) {
      try {
        await queryInterface.removeIndex('legal_pages', ['slug']);
      } catch (_e2) {
        // Index name may differ across environments.
      }
    }

    try {
      await queryInterface.addIndex('legal_pages', ['slug', 'audience'], {
        unique: true,
        name: 'legal_pages_slug_audience_unique'
      });
    } catch (_e) {
      // Already applied.
    }

    // Seed data includes sort_order / flags; add columns here (20260529150000 also adds them idempotently).
    const tableAfterAudience = await queryInterface.describeTable('legal_pages');
    if (!tableAfterAudience.sort_order) {
      await queryInterface.addColumn('legal_pages', 'sort_order', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100,
        after: 'status'
      });
    }
    if (!tableAfterAudience.requires_agreement) {
      await queryInterface.addColumn('legal_pages', 'requires_agreement', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'sort_order'
      });
    }
    if (!tableAfterAudience.show_in_menu) {
      await queryInterface.addColumn('legal_pages', 'show_in_menu', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        after: 'requires_agreement'
      });
    }

    const providerRows = getLegalPagesCarComfortBulkInsertRows('provider');
    for (const row of providerRows) {
      const existing = await queryInterface.sequelize.query(
        'SELECT id FROM legal_pages WHERE slug = :slug AND audience = :audience LIMIT 1',
        {
          replacements: { slug: row.slug, audience: row.audience },
          type: Sequelize.QueryTypes.SELECT
        }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('legal_pages', [row]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    await queryInterface.bulkDelete('legal_pages', { audience: 'provider' });

    try {
      await queryInterface.removeIndex('legal_pages', 'legal_pages_slug_audience_unique');
    } catch (_e) {
      // ignore
    }

    try {
      await queryInterface.addIndex('legal_pages', ['slug'], {
        unique: true,
        name: 'slug'
      });
    } catch (_e) {
      // ignore
    }

    const table = await queryInterface.describeTable('legal_pages');
    if (table.audience) {
      await queryInterface.removeColumn('legal_pages', 'audience');
    }
  }
};
