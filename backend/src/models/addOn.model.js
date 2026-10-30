const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AddOn = sequelize.define(
    'AddOn',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      }
    },
    {
      tableName: 'add_ons',
      underscored: true
    }
  );

  return AddOn;
};

