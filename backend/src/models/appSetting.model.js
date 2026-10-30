const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AppSetting = sequelize.define(
    'AppSetting',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      value: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('text', 'number', 'boolean', 'json', 'image', 'color', 'email', 'url', 'password'),
        allowNull: false,
        defaultValue: 'text',
      },
      group_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'general',
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      is_sensitive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'app_settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return AppSetting;
};
