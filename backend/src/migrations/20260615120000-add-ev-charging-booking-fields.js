'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');

    if (!bookingCols.charger_type) {
      await queryInterface.addColumn('bookings', 'charger_type', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }

    if (!bookingCols.current_battery_status) {
      await queryInterface.addColumn('bookings', 'current_battery_status', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'current_battery_status').catch(() => {});
    await queryInterface.removeColumn('bookings', 'charger_type').catch(() => {});
  },
};
