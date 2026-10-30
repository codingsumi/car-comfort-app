'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'platform_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'service_fee'
    });

    await queryInterface.addColumn('bookings', 'tax', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'platform_fee'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'tax');
    await queryInterface.removeColumn('bookings', 'platform_fee');
  }
};
