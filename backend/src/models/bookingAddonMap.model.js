const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingAddonMap = sequelize.define(
    'BookingAddonMap',
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
      addon_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      tableName: 'booking_addons_map',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at'
    }
  );

  return BookingAddonMap;
};

