const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationState = sequelize.define(
    'NotificationState',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      enroute_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      last_notified_at: { type: DataTypes.DATE, allowNull: true },
      last_distance_bucket: { type: DataTypes.STRING(32), allowNull: true }
    },
    {
      tableName: 'notification_state',
      underscored: true,
      updatedAt: false,
      createdAt: false,
      timestamps: false
    }
  );

  return NotificationState;
};
