const { DataTypes } = require('sequelize');

const SERVICE_TYPES = [
  'car_wash',
  'ev_charging',
  'combo',
  'add_on',
  'convenience_fee',
  'cancellation_fee',
];

const LOCATION_TYPES = ['default', 'country', 'state', 'county', 'city'];

module.exports = (sequelize) => {
  const PricingRule = sequelize.define(
    'PricingRule',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      service_type: {
        type: DataTypes.ENUM(...SERVICE_TYPES),
        allowNull: false,
      },
      location_type: {
        type: DataTypes.ENUM(...LOCATION_TYPES),
        allowNull: false,
        defaultValue: 'default',
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      county: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      base_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      surge_multiplier: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      surge_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      tax_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commission_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      provider_earning_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      peak_hour_multiplier: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      peak_hour_start: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      peak_hour_end: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      weekend_multiplier: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      effective_from: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      effective_to: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: 'pricing_rules',
      underscored: true,
    }
  );

  return PricingRule;
};
