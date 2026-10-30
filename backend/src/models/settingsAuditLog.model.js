const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SettingsAuditLog = sequelize.define(
    'SettingsAuditLog',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      group_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      setting_key: {
        type: DataTypes.STRING(191),
        allowNull: false,
      },
      old_value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      new_value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: 'settings_audit_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return SettingsAuditLog;
};
