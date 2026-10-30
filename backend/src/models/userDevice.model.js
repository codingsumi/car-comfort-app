const { DataTypes } = require('sequelize');

const PLATFORMS = ['android', 'ios', 'web'];

module.exports = (sequelize) => {
  const UserDevice = sequelize.define(
    'UserDevice',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      onesignal_id: { type: DataTypes.STRING(128), allowNull: false },
      platform: { type: DataTypes.STRING(16), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      device_model: { type: DataTypes.STRING(255), allowNull: true },
      app_version: { type: DataTypes.STRING(32), allowNull: true },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
      last_login_ip: { type: DataTypes.STRING(45), allowNull: true },
    },
    {
      tableName: 'user_devices',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['user_id'] }, { fields: ['user_id', 'is_active'] }]
    }
  );

  UserDevice.PLATFORMS = PLATFORMS;
  return UserDevice;
};
