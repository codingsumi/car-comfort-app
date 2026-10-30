const { DataTypes } = require('sequelize');

const WALLET_TRANSACTION_TYPES = [
  'booking_accept_credit',
  'booking_service_start_advance',
  'booking_complete_release',
  'booking_complete_balance',
  'booking_cancel_reversal',
  'booking_tip_credit',
  'cancellation_provider_share',
  'payout_debit',
  'adjustment_credit',
  'adjustment_debit',
  'reversal_debit',
];

module.exports = (sequelize) => {
  const ProviderWalletTransaction = sequelize.define(
    'ProviderWalletTransaction',
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
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      provider_payout_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      transaction_type: {
        type: DataTypes.ENUM(...WALLET_TRANSACTION_TYPES),
        allowNull: false,
      },
      ledger_type: {
        type: DataTypes.ENUM('credit', 'debit'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed',
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      balance_after: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'usd',
      },
      description: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
    },
    {
      tableName: 'provider_wallet_transactions',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at',
    }
  );

  return ProviderWalletTransaction;
};
