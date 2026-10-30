'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');
    if (!table.tutorial_completed_at) {
      await queryInterface.addColumn('driver_profiles', 'tutorial_completed_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'completed_at',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('driver_profiles')) return;

    const table = await queryInterface.describeTable('driver_profiles');
    if (table.tutorial_completed_at) {
      await queryInterface.removeColumn('driver_profiles', 'tutorial_completed_at');
    }
  },
};
