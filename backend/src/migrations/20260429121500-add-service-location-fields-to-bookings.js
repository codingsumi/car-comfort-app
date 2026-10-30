'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');

    if (!bookingCols.service_address) {
      await queryInterface.addColumn('bookings', 'service_address', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!bookingCols.service_latitude) {
      await queryInterface.addColumn('bookings', 'service_latitude', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
    }

    if (!bookingCols.service_longitude) {
      await queryInterface.addColumn('bookings', 'service_longitude', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'service_longitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_latitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_address').catch(() => {});
  }
};
