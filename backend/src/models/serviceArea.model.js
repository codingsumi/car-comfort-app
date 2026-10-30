const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceArea = sequelize.define(
    'ServiceArea',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(191),
        allowNull: false,
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
      zip_codes: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
      boundary_geojson: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'service_areas',
      underscored: true,
    }
  );

  return ServiceArea;
};
