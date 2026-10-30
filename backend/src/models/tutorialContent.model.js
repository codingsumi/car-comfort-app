const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TutorialContent = sequelize.define(
    'TutorialContent',
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
      video_url: {
        type: DataTypes.STRING(2048),
        allowNull: true
      },
      instructions_json: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        defaultValue: '[]'
      }
    },
    {
      tableName: 'tutorial_contents',
      underscored: true
    }
  );

  return TutorialContent;
};
