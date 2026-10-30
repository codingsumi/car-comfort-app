'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');

    if (!table.service_location_name) {
      await queryInterface.addColumn('bookings', 'service_location_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'service_longitude',
      });
    }

    if (!table.ev_charging_location_name) {
      await queryInterface.addColumn('bookings', 'ev_charging_location_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'charging_longitude',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'ev_charging_location_name').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_location_name').catch(() => {});
  },
};
