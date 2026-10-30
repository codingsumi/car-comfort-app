const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define(
    'Vehicle',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },
      vehicle_type: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      make: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      model: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false
      },
      color: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      nickname: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      license_plate: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      vin_number: {
        type: DataTypes.STRING(17),
        allowNull: true
      },
      license_plate_normalized: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      removed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      removal_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      fuel_type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'GAS'
      },
      battery_capacity_kwh: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
      }
    },
    {
      tableName: 'vehicles',
      underscored: true,
      hooks: {
        beforeValidate(vehicle) {
          const plate = vehicle.getDataValue('license_plate');
          if (plate != null && String(plate).trim()) {
            vehicle.setDataValue('license_plate_normalized', String(plate).trim().toUpperCase());
          }
        }
      }
    }
  );

  return Vehicle;
};
