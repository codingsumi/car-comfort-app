'use strict';

const { DataTypes } = require('sequelize');

/**
 * Idempotent safety net when local/prod DB is behind code.
 * Full migrations should still be run via `npm run db:migrate` / `db:migrate:prod`.
 */
async function ensureDriverProfileColumns(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('driver_profiles')) return;

  const cols = await queryInterface.describeTable('driver_profiles');
  if (!cols.tutorial_completed_at) {
    await queryInterface.addColumn('driver_profiles', 'tutorial_completed_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!cols.drivers_license_expiration_date) {
    await queryInterface.addColumn('driver_profiles', 'drivers_license_expiration_date', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  }

  if (!cols.license_expiry_warning_sent_at) {
    await queryInterface.addColumn('driver_profiles', 'license_expiry_warning_sent_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!cols.license_hold_active) {
    await queryInterface.addColumn('driver_profiles', 'license_hold_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }

  if (!cols.license_expiry_warnings_sent) {
    await queryInterface.addColumn('driver_profiles', 'license_expiry_warnings_sent', {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    });
  }
}

module.exports = { ensureDriverProfileColumns };
