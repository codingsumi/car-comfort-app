const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleFlag = sequelize.define(
    'VehicleFlag',
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
      flag_type: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      review_status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'open'
      },
      resolution_notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      flagged_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      resolved_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'vehicle_flags',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  return VehicleFlag;
};
