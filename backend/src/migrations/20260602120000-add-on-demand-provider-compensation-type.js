'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('packages', 'on_demand_provider_compensation_type', {
      type: Sequelize.ENUM('fixed', 'percentage'),
      allowNull: true,
      defaultValue: null,
      after: 'provider_compensation_type',
    });

    await queryInterface.addColumn('bookings', 'on_demand_provider_compensation_type', {
      type: Sequelize.ENUM('fixed', 'percentage'),
      allowNull: true,
      defaultValue: null,
      after: 'on_demand_provider_compensation_value',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'on_demand_provider_compensation_type');
    await queryInterface.removeColumn('packages', 'on_demand_provider_compensation_type');
  },
};

