const { DataTypes } = require('sequelize');

const PAYOUT_STATUSES = ['pending', 'scheduled', 'paid', 'failed', 'cancelled'];

module.exports = (sequelize) => {
  const ProviderPayout = sequelize.define(
    'ProviderPayout',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      initiated_by: {
        type: DataTypes.ENUM('admin', 'driver'),
        allowNull: false,
        defaultValue: 'admin',
      },
      stripe_transfer_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stripe_destination_account: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      gross_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commission_deducted: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      vacuum_fee_deducted: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      refund_adjustments: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax_deducted: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      net_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM(...PAYOUT_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processed_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failure_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      service_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      period_start: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      period_end: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: 'provider_payouts',
      underscored: true,
    }
  );

  return ProviderPayout;
};
