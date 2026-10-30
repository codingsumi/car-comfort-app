const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExportJob = sequelize.define(
    'ExportJob',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      report_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      export_format: {
        type: DataTypes.ENUM('csv', 'xlsx'),
        allowNull: false,
        defaultValue: 'csv',
      },
      filters: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      generated_file_url: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requested_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      row_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: 'export_jobs',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ExportJob;
};
