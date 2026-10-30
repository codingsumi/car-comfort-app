'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('packages', 'on_demand_provider_compensation_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'provider_compensation_value',
    });

    await queryInterface.addColumn('bookings', 'on_demand_provider_compensation_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'provider_compensation_amount',
    });

    await queryInterface.addColumn('bookings', 'on_demand_provider_compensation_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'on_demand_provider_compensation_value',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'on_demand_provider_compensation_amount');
    await queryInterface.removeColumn('bookings', 'on_demand_provider_compensation_value');
    await queryInterface.removeColumn('packages', 'on_demand_provider_compensation_value');
  },
};

