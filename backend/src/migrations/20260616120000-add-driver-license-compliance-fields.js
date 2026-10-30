'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');

    if (!table.drivers_license_expiration_date) {
      await queryInterface.addColumn('driver_profiles', 'drivers_license_expiration_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.license_expiry_warning_sent_at) {
      await queryInterface.addColumn('driver_profiles', 'license_expiry_warning_sent_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.license_hold_active) {
      await queryInterface.addColumn('driver_profiles', 'license_hold_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');
    if (table.license_hold_active) {
      await queryInterface.removeColumn('driver_profiles', 'license_hold_active');
    }
    if (table.license_expiry_warning_sent_at) {
      await queryInterface.removeColumn('driver_profiles', 'license_expiry_warning_sent_at');
    }
    if (table.drivers_license_expiration_date) {
      await queryInterface.removeColumn('driver_profiles', 'drivers_license_expiration_date');
    }
  },
};
