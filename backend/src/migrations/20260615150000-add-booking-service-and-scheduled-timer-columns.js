'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');

    if (!table.scheduled_pickup_window_start_at) {
      await queryInterface.addColumn('bookings', 'scheduled_pickup_window_start_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.scheduled_pickup_deadline_at) {
      await queryInterface.addColumn('bookings', 'scheduled_pickup_deadline_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.service_started_at) {
      await queryInterface.addColumn('bookings', 'service_started_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.service_timer_expires_at) {
      await queryInterface.addColumn('bookings', 'service_timer_expires_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.service_completed_at) {
      await queryInterface.addColumn('bookings', 'service_completed_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.service_duration_minutes) {
      await queryInterface.addColumn('bookings', 'service_duration_minutes', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'service_duration_minutes').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_completed_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_timer_expires_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_started_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'scheduled_pickup_deadline_at').catch(() => {});
    await queryInterface.removeColumn('bookings', 'scheduled_pickup_window_start_at').catch(() => {});
  },
};
