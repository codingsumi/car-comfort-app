const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverProfile = sequelize.define(
    'DriverProfile',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true
      },
      profile_picture: {
        type: DataTypes.STRING(2048),
        allowNull: true
      },
      step_data: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      current_step: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      is_completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      tutorial_completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      approval_status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      approval_reason: {
        type: DataTypes.STRING(1024),
        allowNull: true
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      approved_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      rejected_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      insurance_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      drivers_license_expiration_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      license_expiry_warning_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      license_hold_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      license_expiry_warnings_sent: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      }
    },
    {
      tableName: 'driver_profiles',
      underscored: true
    }
  );

  return DriverProfile;
};

