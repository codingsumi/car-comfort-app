const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformReportNote = sequelize.define(
    'PlatformReportNote',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      admin_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: false },
      is_internal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'platform_report_notes',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return PlatformReportNote;
};
