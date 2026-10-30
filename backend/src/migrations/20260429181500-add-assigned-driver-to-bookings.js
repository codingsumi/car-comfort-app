'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');

    if (!bookingCols.assigned_driver_user_id) {
      await queryInterface.addColumn('bookings', 'assigned_driver_user_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // Helpful for driver-scoped pagination with optional status filtering.
    await queryInterface.addIndex('bookings', ['assigned_driver_user_id', 'status', 'created_at']).catch(() => {});
    await queryInterface.addIndex('bookings', ['user_id', 'status', 'created_at']).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('bookings', ['user_id', 'status', 'created_at']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['assigned_driver_user_id', 'status', 'created_at']).catch(() => {});
    await queryInterface.removeColumn('bookings', 'assigned_driver_user_id').catch(() => {});
  }
};

