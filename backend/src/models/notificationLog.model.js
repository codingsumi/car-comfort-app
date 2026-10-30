const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationLog = sequelize.define(
    'NotificationLog',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      notification_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: 'type'
      },
      unique_key: { type: DataTypes.STRING(190), allowNull: false },
      meta: { type: DataTypes.JSON, allowNull: true },
      notification_status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        field: 'status'
      },
      sent_at: { type: DataTypes.DATE, allowNull: false }
    },
    {
      tableName: 'notification_logs',
      underscored: true,
      updatedAt: false,
      createdAt: false,
      timestamps: false
    }
  );

  return NotificationLog;
};
