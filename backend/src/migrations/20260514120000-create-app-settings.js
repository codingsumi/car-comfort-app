'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());

    if (!tables.includes('app_settings')) {
      await queryInterface.createTable('app_settings', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        key: {
          type: Sequelize.STRING(191),
          allowNull: false,
          unique: true,
        },
        value: {
          type: Sequelize.TEXT('long'),
          allowNull: true,
        },
        type: {
          type: Sequelize.ENUM('text', 'number', 'boolean', 'json', 'image', 'color', 'email', 'url', 'password'),
          allowNull: false,
          defaultValue: 'text',
        },
        group_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'general',
        },
        label: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        description: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        is_sensitive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_public: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('app_settings', ['group_name'], { name: 'idx_app_settings_group' });
      await queryInterface.addIndex('app_settings', ['is_public'], { name: 'idx_app_settings_public' });
    }

    if (!tables.includes('settings_audit_logs')) {
      await queryInterface.createTable('settings_audit_logs', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        group_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        setting_key: {
          type: Sequelize.STRING(191),
          allowNull: false,
        },
        old_value: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        new_value: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
        },
        user_agent: {
          type: Sequelize.STRING(500),
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('settings_audit_logs', ['user_id'], { name: 'idx_audit_user' });
      await queryInterface.addIndex('settings_audit_logs', ['group_name'], { name: 'idx_audit_group' });
      await queryInterface.addIndex('settings_audit_logs', ['created_at'], { name: 'idx_audit_created' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('settings_audit_logs');
    await queryInterface.dropTable('app_settings');
  },
};
