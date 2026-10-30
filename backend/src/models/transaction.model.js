const { DataTypes } = require('sequelize');

const TRANSACTION_TYPES = [
  'booking_payment',
  'refund',
  'partial_refund',
  'provider_payout',
  'adjustment',
  'manual_payout',
  'commission_deduction',
];

const TRANSACTION_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
];

module.exports = (sequelize) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      transaction_code: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      booking_transaction_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      customer_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      transaction_type: {
        type: DataTypes.ENUM(...TRANSACTION_TYPES),
        allowNull: false,
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stripe_charge_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stripe_transfer_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stripe_refund_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      provider_earning: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      net_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM(...TRANSACTION_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'transactions',
      underscored: true,
    }
  );

  return Transaction;
};
