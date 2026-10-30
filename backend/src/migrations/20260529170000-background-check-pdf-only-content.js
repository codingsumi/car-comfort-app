'use strict';

const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('legal_pages')) return;

    const rows = await queryInterface.sequelize.query(
      `SELECT id, description_json FROM legal_pages
       WHERE audience = 'provider' AND slug = 'background-check-authorization'`,
      { type: QueryTypes.SELECT }
    );

    const now = new Date();
    for (const row of rows) {
      let parsed = row.description_json;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (_e) {
          parsed = {};
        }
      }
      if (!parsed || typeof parsed !== 'object') parsed = {};

      const pdfUrl = typeof parsed.pdf_url === 'string' ? parsed.pdf_url.trim() : '';
      const next = { html: '' };
      if (pdfUrl) next.pdf_url = pdfUrl;

      await queryInterface.sequelize.query(
        `UPDATE legal_pages SET description_json = :json, updated_at = :updated_at WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            json: JSON.stringify(next),
            updated_at: now
          }
        }
      );
    }
  },

  async down() {
    // HTML content was admin-managed; do not restore placeholder copy on rollback.
  }
};
