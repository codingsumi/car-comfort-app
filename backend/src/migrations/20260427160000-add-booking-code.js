'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_counters', {
      booking_date: {
        type: Sequelize.STRING(8), // YYYYMMDD
        allowNull: false,
        primaryKey: true
      },
      last_sequence: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addColumn('bookings', 'booking_code', {
      type: Sequelize.STRING(32),
      allowNull: true
    });

    await queryInterface.addIndex('bookings', ['booking_code'], { unique: true, name: 'uq_bookings_booking_code' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('bookings', 'uq_bookings_booking_code').catch(() => {});
    await queryInterface.removeColumn('bookings', 'booking_code').catch(() => {});
    await queryInterface.dropTable('booking_counters');
  }
};

