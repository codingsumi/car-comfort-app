'use strict';

const { Op } = require('sequelize');

/**
 * Backfills default legal pages when the table exists but seed rows were never inserted
 * (e.g. earlier migration run that created the table then failed before bulkInsert).
 */
const { getLegalPagesCarComfortBulkInsertRows } = require('../seeders/data/legalPagesCarComfort');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const countRows = await queryInterface.sequelize.query('SELECT COUNT(*) AS c FROM legal_pages', {
      type: Sequelize.QueryTypes.SELECT
    });
    if (Number(countRows?.[0]?.c ?? 0) > 0) return;

    await queryInterface.bulkInsert('legal_pages', getLegalPagesCarComfortBulkInsertRows());
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('legal_pages', {
      slug: { [Op.in]: ['privacy-policy', 'terms-conditions', 'support'] }
    });
  }
};
