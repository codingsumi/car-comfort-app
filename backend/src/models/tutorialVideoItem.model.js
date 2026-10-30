const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TutorialVideoItem = sequelize.define(
    'TutorialVideoItem',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      audience: {
        type: DataTypes.ENUM('customer', 'driver'),
        allowNull: false,
        defaultValue: 'customer'
      },
      category: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'General'
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      instructions_json: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      video_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
      },
      sort_order: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 100
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: 'tutorial_video_items',
      underscored: true
    }
  );

  return TutorialVideoItem;
};
