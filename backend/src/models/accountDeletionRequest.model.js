const { DataTypes } = require('sequelize');

const REQUEST_STATUSES = ['otp_pending', 'pending', 'approved', 'rejected'];
const REQUEST_SOURCES = ['app', 'public'];

module.exports = (sequelize) => {
  const AccountDeletionRequest = sequelize.define(
    'AccountDeletionRequest',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      role: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { isEmail: true }
      },
      phone: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      source: {
        type: DataTypes.ENUM(...REQUEST_SOURCES),
        allowNull: false,
        defaultValue: 'app'
      },
      status: {
        type: DataTypes.ENUM(...REQUEST_STATUSES),
        allowNull: false,
        defaultValue: 'pending'
      },
      otp_code: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      otp_expiry: {
        type: DataTypes.DATE,
        allowNull: true
      },
      otp_verified_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      processed_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      admin_note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      user_snapshot: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      tableName: 'account_deletion_requests',
      underscored: true
    }
  );

  return AccountDeletionRequest;
};
