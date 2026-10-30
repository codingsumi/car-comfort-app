'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('packages', 'provider_compensation_type', {
      type: Sequelize.ENUM('fixed', 'percentage'),
      allowNull: false,
      defaultValue: 'percentage',
      after: 'base_price',
    });

    await queryInterface.addColumn('packages', 'provider_compensation_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 100,
      after: 'provider_compensation_type',
    });

    await queryInterface.addColumn('bookings', 'provider_compensation_type', {
      type: Sequelize.ENUM('fixed', 'percentage'),
      allowNull: true,
      after: 'base_price',
    });

    await queryInterface.addColumn('bookings', 'provider_compensation_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'provider_compensation_type',
    });

    await queryInterface.addColumn('bookings', 'provider_compensation_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'provider_compensation_value',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'provider_compensation_amount');
    await queryInterface.removeColumn('bookings', 'provider_compensation_value');
    await queryInterface.removeColumn('bookings', 'provider_compensation_type');
    await queryInterface.removeColumn('packages', 'provider_compensation_value');
    await queryInterface.removeColumn('packages', 'provider_compensation_type');
  },
};

