const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Package = sequelize.define(
    'Package',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      service_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      base_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      provider_compensation_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: false,
        defaultValue: 'percentage'
      },
      on_demand_provider_compensation_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: true,
        defaultValue: null
      },
      provider_compensation_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100
      },
      on_demand_provider_compensation_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
      },
      duration_minutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: 'packages',
      underscored: true
    }
  );

  return Package;
};

