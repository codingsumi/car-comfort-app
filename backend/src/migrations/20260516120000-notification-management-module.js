'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());

    if (!tables.includes('notification_templates')) {
      await queryInterface.createTable('notification_templates', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        template_name: { type: Sequelize.STRING(120), allowNull: false },
        template_type: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        title_template: { type: Sequelize.STRING(255), allowNull: false },
        body_template: { type: Sequelize.TEXT, allowNull: false },
        variables: { type: Sequelize.JSON, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
      await queryInterface.addIndex('notification_templates', ['template_type'], {
        name: 'idx_notification_templates_type',
      });
      await queryInterface.addIndex('notification_templates', ['is_active'], {
        name: 'idx_notification_templates_active',
      });
    }

    if (!tables.includes('notification_campaigns')) {
      await queryInterface.createTable('notification_campaigns', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        campaign_name: { type: Sequelize.STRING(160), allowNull: false },
        notification_type: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'promotional',
        },
        title: { type: Sequelize.STRING(255), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        image_url: { type: Sequelize.STRING(512), allowNull: true },
        deep_link_url: { type: Sequelize.STRING(512), allowNull: true },
        cta_text: { type: Sequelize.STRING(64), allowNull: true },
        cta_url: { type: Sequelize.STRING(512), allowNull: true },
        channels: { type: Sequelize.JSON, allowNull: false },
        audience_filters: { type: Sequelize.JSON, allowNull: false },
        delivery_stats: { type: Sequelize.JSON, allowNull: true },
        status: {
          type: Sequelize.STRING(24),
          allowNull: false,
          defaultValue: 'draft',
        },
        timezone: { type: Sequelize.STRING(64), allowNull: true, defaultValue: 'UTC' },
        scheduled_at: { type: Sequelize.DATE, allowNull: true },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        recurring_rule: { type: Sequelize.JSON, allowNull: true },
        template_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'notification_templates', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
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
      await queryInterface.addIndex('notification_campaigns', ['status'], {
        name: 'idx_notification_campaigns_status',
      });
      await queryInterface.addIndex('notification_campaigns', ['scheduled_at'], {
        name: 'idx_notification_campaigns_scheduled',
      });
      await queryInterface.addIndex('notification_campaigns', ['created_by'], {
        name: 'idx_notification_campaigns_created_by',
      });
    }

    if (!tables.includes('notification_delivery_logs')) {
      await queryInterface.createTable('notification_delivery_logs', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        campaign_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'notification_campaigns', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        notification_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'notifications', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        recipient_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        channel: { type: Sequelize.STRING(16), allowNull: false },
        delivery_status: { type: Sequelize.STRING(24), allowNull: false },
        delivered_at: { type: Sequelize.DATE, allowNull: true },
        opened_at: { type: Sequelize.DATE, allowNull: true },
        clicked_at: { type: Sequelize.DATE, allowNull: true },
        failure_reason: { type: Sequelize.TEXT, allowNull: true },
        retry_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        device_token: { type: Sequelize.STRING(128), allowNull: true },
        meta: { type: Sequelize.JSON, allowNull: true },
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
      await queryInterface.addIndex('notification_delivery_logs', ['campaign_id'], {
        name: 'idx_notification_delivery_logs_campaign',
      });
      await queryInterface.addIndex('notification_delivery_logs', ['recipient_id'], {
        name: 'idx_notification_delivery_logs_recipient',
      });
      await queryInterface.addIndex('notification_delivery_logs', ['channel', 'delivery_status'], {
        name: 'idx_notification_delivery_logs_channel_status',
      });
      await queryInterface.addIndex('notification_delivery_logs', ['created_at'], {
        name: 'idx_notification_delivery_logs_created',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notification_delivery_logs');
    await queryInterface.dropTable('notification_campaigns');
    await queryInterface.dropTable('notification_templates');
  },
};
