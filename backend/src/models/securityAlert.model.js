const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityAlert = sequelize.define(
    'SecurityAlert',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      alert_type: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
      },
      entity_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      entity_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('open', 'investigating', 'resolved'),
        allowNull: false,
        defaultValue: 'open',
      },
      recommended_action: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      resolved_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'security_alerts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return SecurityAlert;
};
