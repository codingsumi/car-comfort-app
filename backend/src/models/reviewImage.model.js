const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ReviewImage = sequelize.define(
    'ReviewImage',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      review_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      image_url: {
        type: DataTypes.STRING(2048),
        allowNull: false
      }
    },
    {
      tableName: 'review_images',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );

  return ReviewImage;
};

