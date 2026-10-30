const { DataTypes } = require('sequelize');

const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];

module.exports = (sequelize) => {
  const Service = sequelize.define(
    'Service',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.ENUM(...SERVICE_TYPES),
        allowNull: false,
        unique: true
      },
      icon: {
        type: DataTypes.STRING(2048),
        allowNull: true
      }
    },
    {
      tableName: 'services',
      underscored: true
    }
  );

  return Service;
};

