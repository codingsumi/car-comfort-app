const { DataTypes } = require('sequelize');

const DELIVERY_STATUSES = ['pending', 'delivered', 'opened', 'clicked', 'failed', 'skipped'];

module.exports = (sequelize) => {
  const NotificationDeliveryLog = sequelize.define(
    'NotificationDeliveryLog',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      notification_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      recipient_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      channel: { type: DataTypes.STRING(16), allowNull: false },
      delivery_status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        validate: { isIn: [DELIVERY_STATUSES] },
      },
      delivered_at: { type: DataTypes.DATE, allowNull: true },
      opened_at: { type: DataTypes.DATE, allowNull: true },
      clicked_at: { type: DataTypes.DATE, allowNull: true },
      failure_reason: { type: DataTypes.TEXT, allowNull: true },
      retry_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      device_token: { type: DataTypes.STRING(128), allowNull: true },
      onesignal_notification_id: { type: DataTypes.STRING(64), allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },
    },
    {
      tableName: 'notification_delivery_logs',
      underscored: true,
    }
  );

  NotificationDeliveryLog.STATUSES = DELIVERY_STATUSES;
  return NotificationDeliveryLog;
};
