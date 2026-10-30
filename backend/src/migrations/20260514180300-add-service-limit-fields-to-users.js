'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'daily_service_limit', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
      after: 'location_updated_at',
    });

    await queryInterface.addColumn('users', 'service_limit_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'daily_service_limit',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'service_limit_enabled');
    await queryInterface.removeColumn('users', 'daily_service_limit');
  },
};
