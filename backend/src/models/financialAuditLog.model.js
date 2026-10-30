const { DataTypes } = require('sequelize');

const AUDIT_ACTIONS = [
  'manual_payout',
  'refund_processed',
  'pricing_created',
  'pricing_updated',
  'pricing_deleted',
  'commission_changed',
  'deduction_applied',
];

module.exports = (sequelize) => {
  const FinancialAuditLog = sequelize.define(
    'FinancialAuditLog',
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
      action: {
        type: DataTypes.ENUM(...AUDIT_ACTIONS),
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      previous_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      new_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'financial_audit_logs',
      underscored: true,
      updatedAt: false,
    }
  );

  return FinancialAuditLog;
};
