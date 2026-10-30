'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    const table = await queryInterface.describeTable('legal_pages');
    if (!table.audience) return;

    await queryInterface.sequelize.query(
      "ALTER TABLE legal_pages MODIFY COLUMN audience ENUM('customer', 'provider', 'common') NOT NULL DEFAULT 'customer'"
    );
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('legal_pages')) return;

    await queryInterface.bulkDelete('legal_pages', { audience: 'common' });

    await queryInterface.sequelize.query(
      "ALTER TABLE legal_pages MODIFY COLUMN audience ENUM('customer', 'provider') NOT NULL DEFAULT 'customer'"
    );
  }
};
