'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (table.token_version) return;

    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (!table.token_version) return;

    await queryInterface.removeColumn('users', 'token_version');
  }
};

