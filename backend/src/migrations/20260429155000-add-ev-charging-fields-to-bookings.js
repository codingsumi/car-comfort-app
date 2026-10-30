 'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');

    if (!bookingCols.ev_charging_address) {
      await queryInterface.addColumn('bookings', 'ev_charging_address', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!bookingCols.charging_latitude) {
      await queryInterface.addColumn('bookings', 'charging_latitude', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
    }

    if (!bookingCols.charging_longitude) {
      await queryInterface.addColumn('bookings', 'charging_longitude', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'charging_longitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'charging_latitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'ev_charging_address').catch(() => {});
  }
};

