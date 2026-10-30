const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingImage = sequelize.define(
    'BookingImage',
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
      image_url: {
        type: DataTypes.STRING(2048),
        allowNull: false
      },
      image_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'customer'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      tableName: 'booking_images',
      underscored: true,
      updatedAt: false,
      createdAt: 'created_at'
    }
  );

  return BookingImage;
};

