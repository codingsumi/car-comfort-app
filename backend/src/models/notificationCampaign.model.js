const { DataTypes } = require('sequelize');

const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];

module.exports = (sequelize) => {
  const NotificationCampaign = sequelize.define(
    'NotificationCampaign',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      campaign_name: { type: DataTypes.STRING(160), allowNull: false },
      notification_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'promotional',
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      image_url: { type: DataTypes.STRING(512), allowNull: true },
      deep_link_url: { type: DataTypes.STRING(512), allowNull: true },
      cta_text: { type: DataTypes.STRING(64), allowNull: true },
      cta_url: { type: DataTypes.STRING(512), allowNull: true },
      channels: { type: DataTypes.JSON, allowNull: false },
      audience_filters: { type: DataTypes.JSON, allowNull: false },
      delivery_stats: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'draft',
        validate: { isIn: [CAMPAIGN_STATUSES] },
      },
      timezone: { type: DataTypes.STRING(64), allowNull: true, defaultValue: 'UTC' },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
      recurring_rule: { type: DataTypes.JSON, allowNull: true },
      template_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    },
    {
      tableName: 'notification_campaigns',
      underscored: true,
    }
  );

  NotificationCampaign.STATUSES = CAMPAIGN_STATUSES;
  return NotificationCampaign;
};
