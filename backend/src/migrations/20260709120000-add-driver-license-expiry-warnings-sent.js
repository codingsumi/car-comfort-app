'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');
    if (!table.license_expiry_warnings_sent) {
      await queryInterface.addColumn('driver_profiles', 'license_expiry_warnings_sent', {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');
    if (table.license_expiry_warnings_sent) {
      await queryInterface.removeColumn('driver_profiles', 'license_expiry_warnings_sent');
    }
  },
};
