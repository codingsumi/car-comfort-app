'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'price_summary', {
      type: Sequelize.JSON,
      allowNull: true,
      after: 'total_price',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'price_summary');
  },
};
