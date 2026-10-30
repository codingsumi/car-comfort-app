'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingTrackingLog = sequelize.define(
    'BookingTrackingLog',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      tracking_status: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      message: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'booking_tracking_logs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );

  return BookingTrackingLog;
};
