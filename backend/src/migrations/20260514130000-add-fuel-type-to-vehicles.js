'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('vehicles', 'fuel_type', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'OTHER',
      after: 'license_plate'
    });

    await queryInterface.addColumn('vehicles', 'battery_capacity_kwh', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'fuel_type'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('vehicles', 'battery_capacity_kwh');
    await queryInterface.removeColumn('vehicles', 'fuel_type');
  }
};
