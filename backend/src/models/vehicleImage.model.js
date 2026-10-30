const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleImage = sequelize.define(
    'VehicleImage',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      vehicle_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      image_path: {
        type: DataTypes.STRING(512),
        allowNull: false
      },
      image_type: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'other'
      },
      is_flagged: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      flagged_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      flagged_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'vehicle_images',
      underscored: true
    }
  );

  return VehicleImage;
};
