const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AnalyticsCache = sequelize.define(
    'AnalyticsCache',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      metric_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      metric_value: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      filters_hash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      generated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'analytics_cache',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return AnalyticsCache;
};
