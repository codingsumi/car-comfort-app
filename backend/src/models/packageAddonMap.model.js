const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PackageAddonMap = sequelize.define(
    'PackageAddonMap',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      package_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      addon_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      }
    },
    {
      tableName: 'package_addons_map',
      underscored: true,
      timestamps: false
    }
  );

  return PackageAddonMap;
};

