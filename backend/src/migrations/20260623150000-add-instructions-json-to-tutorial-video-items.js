'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('tutorial_video_items')) return;

    const table = await queryInterface.describeTable('tutorial_video_items');
    if (!table.instructions_json) {
      await queryInterface.addColumn('tutorial_video_items', 'instructions_json', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('tutorial_video_items')) return;

    const table = await queryInterface.describeTable('tutorial_video_items');
    if (table.instructions_json) {
      await queryInterface.removeColumn('tutorial_video_items', 'instructions_json');
    }
  }
};
