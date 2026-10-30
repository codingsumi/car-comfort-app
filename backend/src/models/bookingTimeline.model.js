const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingTimeline = sequelize.define(
    'BookingTimeline',
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
      event_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      actor_type: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      actor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'booking_timeline',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at',
    }
  );

  return BookingTimeline;
};
