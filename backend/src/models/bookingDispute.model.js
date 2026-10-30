const { DataTypes } = require('sequelize');

const DISPUTE_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

module.exports = (sequelize) => {
  const BookingDispute = sequelize.define(
    'BookingDispute',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      customer_complaint: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      provider_response: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...DISPUTE_STATUSES),
        allowNull: false,
        defaultValue: 'open',
      },
      resolved_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'booking_disputes',
      underscored: true,
    }
  );

  return BookingDispute;
};
