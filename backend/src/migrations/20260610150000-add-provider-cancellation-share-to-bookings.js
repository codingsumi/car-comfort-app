'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'provider_cancellation_share_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'cancellation_fee',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'provider_cancellation_share_amount');
  },
};
