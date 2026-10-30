'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    // Allow social accounts to exist without email/phone/password (backward compatible).
    // MySQL UNIQUE allows multiple NULLs, so existing uniqueness constraints remain effective for normal users.
    if (table.email && table.email.allowNull === false) {
      await queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      });
    }

    if (table.phone && table.phone.allowNull === false) {
      await queryInterface.changeColumn('users', 'phone', {
        type: Sequelize.STRING(32),
        allowNull: true,
        unique: true
      });
    }

    if (table.password && table.password.allowNull === false) {
      await queryInterface.changeColumn('users', 'password', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    if (!table.auth_type) {
      await queryInterface.addColumn('users', 'auth_type', {
        type: Sequelize.ENUM('normal', 'social'),
        allowNull: false,
        defaultValue: 'normal',
        after: 'password'
      });
    }

    if (!table.social_type) {
      await queryInterface.addColumn('users', 'social_type', {
        type: Sequelize.ENUM('google', 'apple', 'facebook'),
        allowNull: true,
        after: 'auth_type'
      });
    }

    if (!table.social_id) {
      await queryInterface.addColumn('users', 'social_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        after: 'social_type'
      });
    }

    if (!table.social_token) {
      await queryInterface.addColumn('users', 'social_token', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'social_id'
      });
    }

    // Best-effort uniqueness for social identity (provider + subject).
    try {
      await queryInterface.addIndex('users', ['social_type', 'social_id'], {
        unique: true,
        name: 'users_social_type_social_id_unique'
      });
    } catch (_e) {
      // ignore if already exists
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('users', 'users_social_type_social_id_unique');
    } catch (_e) {
      // ignore
    }

    const table = await queryInterface.describeTable('users');

    if (table.social_token) await queryInterface.removeColumn('users', 'social_token');
    if (table.social_id) await queryInterface.removeColumn('users', 'social_id');
    if (table.social_type) await queryInterface.removeColumn('users', 'social_type');
    if (table.auth_type) await queryInterface.removeColumn('users', 'auth_type');

    // Revert core fields back to required (matches original schema).
    if (table.password && table.password.allowNull === true) {
      await queryInterface.changeColumn('users', 'password', {
        type: Sequelize.STRING(255),
        allowNull: false
      });
    }

    if (table.phone && table.phone.allowNull === true) {
      await queryInterface.changeColumn('users', 'phone', {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true
      });
    }

    if (table.email && table.email.allowNull === true) {
      await queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      });
    }

    // Cleanup enums (MySQL) best-effort.
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS `enum_users_auth_type`;');
    } catch (_e) {}
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS `enum_users_social_type`;');
    } catch (_e) {}
  }
};

