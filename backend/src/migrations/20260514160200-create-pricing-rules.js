'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pricing_rules', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      service_type: {
        type: Sequelize.ENUM(
          'car_wash',
          'ev_charging',
          'combo',
          'add_on',
          'convenience_fee',
          'cancellation_fee'
        ),
        allowNull: false,
      },
      location_type: {
        type: Sequelize.ENUM('default', 'country', 'state', 'county', 'city'),
        allowNull: false,
        defaultValue: 'default',
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      county: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      base_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      surge_multiplier: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      surge_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      tax_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commission_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      provider_earning_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      peak_hour_multiplier: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      peak_hour_start: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      peak_hour_end: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      weekend_multiplier: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      effective_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      effective_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('pricing_rules', ['service_type']);
    await queryInterface.addIndex('pricing_rules', ['location_type']);
    await queryInterface.addIndex('pricing_rules', ['is_active']);
    await queryInterface.addIndex('pricing_rules', ['effective_from', 'effective_to']);
    await queryInterface.addIndex('pricing_rules',
      ['service_type', 'location_type', 'country', 'state', 'county', 'city', 'effective_from'],
      { unique: true, name: 'pricing_rules_unique_scope' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pricing_rules');
  },
};
