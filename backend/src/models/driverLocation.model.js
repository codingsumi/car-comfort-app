const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverLocation = sequelize.define(
    'DriverLocation',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      lat: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
      lng: { type: DataTypes.DECIMAL(11, 8), allowNull: false }
    },
    {
      tableName: 'driver_locations',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at'
    }
  );

  return DriverLocation;
};
