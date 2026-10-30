const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleType = sequelize.define(
    'VehicleType',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active'
      },
      charges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      tableName: 'vehicle_types',
      underscored: true
    }
  );

  return VehicleType;
};

