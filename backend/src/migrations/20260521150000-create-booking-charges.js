'use strict';

const {
  BOOKING_CHARGE_CODES,
  BOOKING_CHARGE_LABELS,
} = require('../constants/bookingChargeCodes');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_charges', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      label: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    const defaults = [
      [BOOKING_CHARGE_CODES.TOWING_SERVICES, 75, 1],
      [BOOKING_CHARGE_CODES.ON_DEMAND_SERVICES, 50, 2],
      [BOOKING_CHARGE_CODES.CONVENIENCE_FEE, 1.99, 3],
      [BOOKING_CHARGE_CODES.CUSTOMER_NO_SHOW_FEE, 25, 4],
      [BOOKING_CHARGE_CODES.CUSTOMER_CANCELLATION_FEE, 25, 5],
    ];

    await queryInterface.bulkInsert(
      'booking_charges',
      defaults.map(([code, amount, sort_order]) => ({
        code,
        label: BOOKING_CHARGE_LABELS[code],
        amount,
        is_active: true,
        sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_charges');
  },
};
