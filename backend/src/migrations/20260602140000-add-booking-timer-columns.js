'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');
    if (!table.driver_accepted_at) {
      await queryInterface.addColumn('bookings', 'driver_accepted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'pickup_otp_expiry',
      });
    }
    if (!table.driver_arrived_customer_at) {
      await queryInterface.addColumn('bookings', 'driver_arrived_customer_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'driver_accepted_at',
      });
    }
    if (!table.on_demand_accept_deadline_at) {
      await queryInterface.addColumn('bookings', 'on_demand_accept_deadline_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'driver_arrived_customer_at',
      });
    }
    if (!table.arrival_wait_expires_at) {
      await queryInterface.addColumn('bookings', 'arrival_wait_expires_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'on_demand_accept_deadline_at',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'arrival_wait_expires_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'on_demand_accept_deadline_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'driver_arrived_customer_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'driver_accepted_at').catch(() => {});
  },
};
