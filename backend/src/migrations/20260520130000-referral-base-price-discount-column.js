'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookings = await queryInterface.describeTable('bookings');
    if (!bookings.base_price_before_discount) {
      await queryInterface.addColumn('bookings', 'base_price_before_discount', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        after: 'base_price'
      });
    }
  },

  async down(queryInterface) {
    const bookings = await queryInterface.describeTable('bookings');
    if (bookings.base_price_before_discount) {
      await queryInterface.removeColumn('bookings', 'base_price_before_discount');
    }
  }
};
