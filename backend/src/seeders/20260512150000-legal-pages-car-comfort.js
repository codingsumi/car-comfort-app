'use strict';

const { getLegalPagesCarComfortRows } = require('./data/legalPagesCarComfort');

/**
 * Seeds / refreshes default Car Comfort legal pages (privacy, terms, support).
 * Safe to run multiple times: updates existing rows by `slug`, inserts if missing.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const rows = getLegalPagesCarComfortRows();

    for (const row of rows) {
      const descJson = JSON.stringify(row.description_json);
      const audience = row.audience || 'customer';
      const [header] = await queryInterface.sequelize.query(
        `UPDATE legal_pages
         SET title = :title,
             description_json = :description_json,
             meta_title = :meta_title,
             meta_description = :meta_description,
             status = :status,
             updated_at = NOW()
         WHERE slug = :slug AND audience = :audience`,
        {
          replacements: {
            title: row.title,
            description_json: descJson,
            meta_title: row.meta_title,
            meta_description: row.meta_description,
            status: row.status ? 1 : 0,
            slug: row.slug,
            audience
          }
        }
      );

      const affected = Number(header?.affectedRows || 0);

      if (affected === 0) {
        await queryInterface.bulkInsert('legal_pages', [
          {
            title: row.title,
            slug: row.slug,
            audience,
            description_json: descJson,
            meta_title: row.meta_title,
            meta_description: row.meta_description,
            status: row.status,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]);
      }
    }
  },

  async down() {
    // Intentionally empty: prior legal copy is not restored.
  }
};
