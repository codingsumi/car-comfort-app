const { DataTypes } = require('sequelize');

const STATUSES = ['requested', 'approved', 'rejected', 'processing', 'refunded'];

module.exports = (sequelize) => {
  const RefundRequest = sequelize.define(
    'RefundRequest',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      booking_transaction_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'requested'
      },
      stripe_refund_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_payload: {
        type: DataTypes.JSON,
        allowNull: true
      },
      processed_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'refund_requests',
      underscored: true
    }
  );

  return RefundRequest;
};

