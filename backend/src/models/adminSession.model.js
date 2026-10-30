const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminSession = sequelize.define(
    'AdminSession',
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
      token_id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      device_info: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      login_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      last_activity_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      is_revoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'admin_sessions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return AdminSession;
};
