'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'country_code', {
      type: Sequelize.STRING(8),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'country_code', {
      type: Sequelize.STRING(2),
      allowNull: true
    });
  }
};

