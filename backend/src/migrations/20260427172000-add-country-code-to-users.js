'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (table.country_code) return;

    await queryInterface.addColumn('users', 'country_code', {
      type: Sequelize.STRING(2),
      allowNull: true,
      after: 'phone'
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (!table.country_code) return;
    await queryInterface.removeColumn('users', 'country_code');
  }
};

