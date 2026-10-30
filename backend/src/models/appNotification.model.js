const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AppNotification = sequelize.define(
    'AppNotification',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      notification_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'type'
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      data: { type: DataTypes.JSON, allowNull: true },
      is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      delivery_key: { type: DataTypes.STRING(190), allowNull: false, unique: true },
      sent_status: { type: DataTypes.STRING(32), allowNull: true },
      push_result: { type: DataTypes.JSON, allowNull: true }
    },
    {
      tableName: 'notifications',
      underscored: true,
      indexes: [{ fields: ['user_id', 'created_at'] }]
    }
  );

  return AppNotification;
};
