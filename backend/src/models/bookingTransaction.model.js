const { DataTypes } = require('sequelize');

const STATUSES = [
  'requires_payment_method',
  'requires_action',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
];

module.exports = (sequelize) => {
  const BookingTransaction = sequelize.define(
    'BookingTransaction',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      transaction_code: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'usd'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false
      },
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      payment_method_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_payload: {
        type: DataTypes.JSON,
        allowNull: true
      },
      stripe_error: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'booking_transactions',
      underscored: true
    }
  );

  return BookingTransaction;
};

