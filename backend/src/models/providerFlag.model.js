const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProviderFlag = sequelize.define(
    'ProviderFlag',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      flag_type: {
        type: DataTypes.ENUM('low_rating', 'high_cancellation', 'high_complaints', 'excessive_disputes', 'late_arrivals', 'manual'),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM('warning', 'critical'),
        allowNull: false,
        defaultValue: 'warning',
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      resolved_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resolution_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      flagged_by: {
        type: DataTypes.ENUM('system', 'admin'),
        allowNull: false,
        defaultValue: 'system',
      },
    },
    {
      tableName: 'provider_flags',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ProviderFlag;
};
