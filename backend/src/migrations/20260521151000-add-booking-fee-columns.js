'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');

    if (!table.convenience_fee) {
      await queryInterface.addColumn('bookings', 'convenience_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!table.on_demand_fee) {
      await queryInterface.addColumn('bookings', 'on_demand_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!table.towing_fee) {
      await queryInterface.addColumn('bookings', 'towing_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'towing_fee').catch(() => {});
    await queryInterface.removeColumn('bookings', 'on_demand_fee').catch(() => {});
    await queryInterface.removeColumn('bookings', 'convenience_fee').catch(() => {});
  },
};
