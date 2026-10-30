const { DataTypes } = require('sequelize');

const STATUSES = ['processing', 'succeeded', 'failed', 'cancelled'];

module.exports = (sequelize) => {
  const BookingTip = sequelize.define(
    'BookingTip',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      customer_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      provider_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'usd',
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'processing',
      },
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      booking_transaction_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: 'booking_tips',
      underscored: true,
    }
  );

  return BookingTip;
};
