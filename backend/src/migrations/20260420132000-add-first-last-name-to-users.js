'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'first_name', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'last_name', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    // Best-effort backfill from existing `name` (split on first space).
    // MySQL-specific string ops; safe to ignore failures (e.g., empty names).
    try {
      await queryInterface.sequelize.query(`
        UPDATE users
        SET
          first_name = COALESCE(first_name, NULLIF(SUBSTRING_INDEX(name, ' ', 1), '')),
          last_name = COALESCE(last_name, NULLIF(TRIM(SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 1)), ''))
        WHERE (first_name IS NULL OR first_name = '') OR (last_name IS NULL OR last_name = '');
      `);
    } catch (_e) {
      // ignore backfill errors
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'last_name');
    await queryInterface.removeColumn('users', 'first_name');
  }
};

