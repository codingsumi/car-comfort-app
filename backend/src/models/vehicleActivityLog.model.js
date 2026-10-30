const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleActivityLog = sequelize.define(
    'VehicleActivityLog',
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
      activity_type: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      actor_type: {
        type: DataTypes.STRING(24),
        allowNull: false
      },
      actor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'vehicle_activity_logs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );

  return VehicleActivityLog;
};
