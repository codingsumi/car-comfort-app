const { DataTypes } = require('sequelize');

const REPORT_TYPES = [
  'inappropriate_behavior',
  'poor_service_quality',
  'fraud_scam',
  'offensive_communication',
  'fake_reviews',
  'payment_dispute',
  'safety_issue',
  'vehicle_damage',
  'missing_item',
  'spam_abuse',
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'under_review', 'investigating', 'resolved', 'dismissed', 'escalated'];

module.exports = (sequelize) => {
  const PlatformReport = sequelize.define(
    'PlatformReport',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      reporter_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      target_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      booking_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      report_type: { type: DataTypes.STRING(64), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      priority: {
        type: DataTypes.ENUM(...PRIORITIES),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'open',
      },
      assigned_to: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      resolution_notes: { type: DataTypes.TEXT, allowNull: true },
      escalated_at: { type: DataTypes.DATE, allowNull: true },
      attachment_urls: { type: DataTypes.JSON, allowNull: true },
    },
    {
      tableName: 'platform_reports',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  PlatformReport.REPORT_TYPES = REPORT_TYPES;
  PlatformReport.PRIORITIES = PRIORITIES;
  PlatformReport.STATUSES = STATUSES;

  return PlatformReport;
};
