'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'current_battery_charge', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'vehicle_charge_limit'
    });

    await queryInterface.addColumn('bookings', 'rate_per_kw', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'current_battery_charge'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'rate_per_kw');
    await queryInterface.removeColumn('bookings', 'current_battery_charge');
  }
};
