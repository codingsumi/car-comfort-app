const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingCharge = sequelize.define(
    'BookingCharge',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      label: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      service_applicability: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'all',
      },
    },
    {
      tableName: 'booking_charges',
      underscored: true,
    }
  );

  return BookingCharge;
};
