const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuthEvent = sequelize.define(
    'AuthEvent',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      email_attempt: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      event_type: {
        type: DataTypes.ENUM('login_success', 'login_failed', 'logout', 'password_reset', 'password_change'),
        allowNull: false,
      },
      actor_type: {
        type: DataTypes.ENUM('admin', 'customer', 'driver', 'garage', 'system'),
        allowNull: false,
        defaultValue: 'admin',
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      device_info: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'auth_events',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return AuthEvent;
};
