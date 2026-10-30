const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ComplianceRequest = sequelize.define(
    'ComplianceRequest',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      request_type: {
        type: DataTypes.ENUM('account_deletion', 'data_export', 'data_anonymization', 'consent_update'),
        allowNull: false,
      },
      request_status: {
        type: DataTypes.ENUM('pending', 'verified', 'processing', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      deletion_type: {
        type: DataTypes.ENUM('soft_delete', 'permanent_delete', 'anonymization'),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      export_url: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      processed_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      processed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'compliance_requests',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ComplianceRequest;
};
