'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');
    if (!table.driver_started_to_service_center_at) {
      await queryInterface.addColumn('bookings', 'driver_started_to_service_center_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'arrival_wait_expires_at',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface
      .removeColumn('bookings', 'driver_started_to_service_center_at')
      .catch(() => {});
  },
};
