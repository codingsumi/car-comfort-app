const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminAuditLog = sequelize.define(
    'AdminAuditLog',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      admin_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      actor_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'admin',
      },
      action_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      severity: {
        type: DataTypes.ENUM('info', 'low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'info',
      },
      device_info: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      old_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      new_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
    },
    {
      tableName: 'admin_audit_logs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return AdminAuditLog;
};
