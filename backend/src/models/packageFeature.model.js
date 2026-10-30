const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PackageFeature = sequelize.define(
    'PackageFeature',
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
      feature_name: {
        type: DataTypes.STRING(255),
        allowNull: false
      }
    },
    {
      tableName: 'package_features',
      underscored: true,
      timestamps: false
    }
  );

  return PackageFeature;
};

