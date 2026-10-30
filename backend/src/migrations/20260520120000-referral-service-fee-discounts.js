'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('users');
    if (!users.referral_reward_pending) {
      await queryInterface.addColumn('users', 'referral_reward_pending', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!users.referral_first_booking_discount_pending) {
      await queryInterface.addColumn('users', 'referral_first_booking_discount_pending', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    const bookings = await queryInterface.describeTable('bookings');
    if (!bookings.base_price_before_discount) {
      await queryInterface.addColumn('bookings', 'base_price_before_discount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        after: 'base_price'
      });
    }
    if (!bookings.referral_discount_amount) {
      await queryInterface.addColumn('bookings', 'referral_discount_amount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        after: 'base_price_before_discount'
      });
    }
    if (!bookings.referral_discount_type) {
      await queryInterface.addColumn('bookings', 'referral_discount_type', {
        type: Sequelize.STRING(32),
        allowNull: true,
        after: 'referral_discount_amount'
      });
    }
  },

  async down(queryInterface) {
    const bookings = await queryInterface.describeTable('bookings');
    if (bookings.referral_discount_type) {
      await queryInterface.removeColumn('bookings', 'referral_discount_type');
    }
    if (bookings.referral_discount_amount) {
      await queryInterface.removeColumn('bookings', 'referral_discount_amount');
    }
    if (bookings.base_price_before_discount) {
      await queryInterface.removeColumn('bookings', 'base_price_before_discount');
    }

    const users = await queryInterface.describeTable('users');
    if (users.referral_first_booking_discount_pending) {
      await queryInterface.removeColumn('users', 'referral_first_booking_discount_pending');
    }
    if (users.referral_reward_pending) {
      await queryInterface.removeColumn('users', 'referral_reward_pending');
    }
  }
};
