'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.latitude) {
      await queryInterface.addColumn('users', 'latitude', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
    }

    if (!table.longitude) {
      await queryInterface.addColumn('users', 'longitude', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
    }

    if (!table.location_updated_at) {
      await queryInterface.addColumn('users', 'location_updated_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    await queryInterface.addIndex('users', ['latitude', 'longitude']).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', ['latitude', 'longitude']).catch(() => {});
    await queryInterface.removeColumn('users', 'location_updated_at').catch(() => {});
    await queryInterface.removeColumn('users', 'longitude').catch(() => {});
    await queryInterface.removeColumn('users', 'latitude').catch(() => {});
  }
};

