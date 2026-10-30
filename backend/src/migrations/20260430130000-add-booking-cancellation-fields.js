'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');

    if (!table.cancelled_at) {
      await queryInterface.addColumn('bookings', 'cancelled_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.cancelled_by) {
      await queryInterface.addColumn('bookings', 'cancelled_by', { type: Sequelize.STRING(32), allowNull: true });
    }
    if (!table.cancellation_reason) {
      await queryInterface.addColumn('bookings', 'cancellation_reason', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!table.cancellation_fee) {
      await queryInterface.addColumn('bookings', 'cancellation_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });
    }
    if (!table.refund_amount) {
      await queryInterface.addColumn('bookings', 'refund_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });
    }

    await queryInterface.addIndex('bookings', ['status', 'cancelled_at']).catch(() => {});
    await queryInterface.addIndex('bookings', ['user_id', 'status', 'cancelled_at']).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('bookings', ['user_id', 'status', 'cancelled_at']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['status', 'cancelled_at']).catch(() => {});
    await queryInterface.removeColumn('bookings', 'refund_amount').catch(() => {});
    await queryInterface.removeColumn('bookings', 'cancellation_fee').catch(() => {});
    await queryInterface.removeColumn('bookings', 'cancellation_reason').catch(() => {});
    await queryInterface.removeColumn('bookings', 'cancelled_by').catch(() => {});
    await queryInterface.removeColumn('bookings', 'cancelled_at').catch(() => {});
  }
};

