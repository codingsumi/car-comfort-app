const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VacuumPenalty = sequelize.define(
    'VacuumPenalty',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      booking_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      penalty_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      deduction_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: false,
        defaultValue: 'fixed',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      evidence_urls: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      issued_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'applied', 'reversed'),
        allowNull: false,
        defaultValue: 'applied',
      },
    },
    {
      tableName: 'vacuum_penalties',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return VacuumPenalty;
};
