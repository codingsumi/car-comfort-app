'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { sequelize } = qi;

    const tables = (await sequelize.query('SHOW TABLES', { type: Sequelize.QueryTypes.SELECT })).map(
      (row) => Object.values(row)[0]
    );

    if (tables.includes('reviews')) {
      const desc = await qi.describeTable('reviews');
      if (!desc.moderation_notes) {
        await qi.addColumn('reviews', 'moderation_notes', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
      if (!desc.flags_count) {
        await qi.addColumn('reviews', 'flags_count', {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        });
      }
      if (!desc.auto_flag_reasons) {
        await qi.addColumn('reviews', 'auto_flag_reasons', {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }
      if (!desc.last_auto_scan_at) {
        await qi.addColumn('reviews', 'last_auto_scan_at', {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
      await qi.addIndex('reviews', ['flags_count'], { name: 'idx_reviews_flags_count' }).catch(() => {});
      await qi.addIndex('reviews', ['moderation_status', 'created_at'], { name: 'idx_reviews_mod_status_created' }).catch(() => {});
    }

    if (!tables.includes('platform_reports')) {
      await qi.createTable('platform_reports', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        reporter_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        target_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        report_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
          allowNull: false,
          defaultValue: 'medium',
        },
        status: {
          type: Sequelize.ENUM('open', 'under_review', 'investigating', 'resolved', 'dismissed', 'escalated'),
          allowNull: false,
          defaultValue: 'open',
        },
        assigned_to: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        resolution_notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        escalated_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        attachment_urls: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await qi.addIndex('platform_reports', ['status', 'priority'], { name: 'idx_platform_reports_status_priority' });
      await qi.addIndex('platform_reports', ['report_type'], { name: 'idx_platform_reports_type' });
      await qi.addIndex('platform_reports', ['created_at'], { name: 'idx_platform_reports_created' });
      await qi.addIndex('platform_reports', ['assigned_to'], { name: 'idx_platform_reports_assigned' });
    }

    if (!tables.includes('platform_report_notes')) {
      await qi.createTable('platform_report_notes', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        report_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        admin_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        is_internal: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await qi.addIndex('platform_report_notes', ['report_id'], { name: 'idx_platform_report_notes_report' });
    }

    if (!tables.includes('support_tickets')) {
      await qi.createTable('support_tickets', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        ticket_number: {
          type: Sequelize.STRING(32),
          allowNull: false,
          unique: true,
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        user_type: {
          type: Sequelize.ENUM('customer', 'driver', 'garage', 'admin'),
          allowNull: false,
        },
        subject: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM('open', 'pending', 'waiting_for_user', 'resolved', 'closed'),
          allowNull: false,
          defaultValue: 'open',
        },
        priority: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
          allowNull: false,
          defaultValue: 'medium',
        },
        assigned_to: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        last_message_preview: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        last_message_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await qi.addIndex('support_tickets', ['status', 'priority'], { name: 'idx_support_tickets_status_priority' });
      await qi.addIndex('support_tickets', ['user_id'], { name: 'idx_support_tickets_user' });
      await qi.addIndex('support_tickets', ['created_at'], { name: 'idx_support_tickets_created' });
    }

    if (!tables.includes('support_messages')) {
      await qi.createTable('support_messages', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        ticket_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        sender_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        sender_role: {
          type: Sequelize.ENUM('customer', 'driver', 'garage', 'admin'),
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        attachments: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        internal_note: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await qi.addIndex('support_messages', ['ticket_id', 'created_at'], { name: 'idx_support_messages_ticket_created' });
    }

    if (!tables.includes('faq_categories')) {
      await qi.createTable('faq_categories', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        slug: {
          type: Sequelize.STRING(120),
          allowNull: false,
          unique: true,
        },
        sort_order: {
          type: Sequelize.INTEGER.UNSIGNED,
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    if (!tables.includes('faqs')) {
      await qi.createTable('faqs', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        category_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
        },
        question: {
          type: Sequelize.STRING(500),
          allowNull: false,
        },
        answer: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM('draft', 'published'),
          allowNull: false,
          defaultValue: 'draft',
        },
        sort_order: {
          type: Sequelize.INTEGER.UNSIGNED,
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
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await qi.addIndex('faqs', ['category_id', 'status', 'sort_order'], { name: 'idx_faqs_category_status_sort' });
    }
  },

  async down(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { sequelize } = qi;
    const tables = (await sequelize.query('SHOW TABLES', { type: Sequelize.QueryTypes.SELECT })).map(
      (row) => Object.values(row)[0]
    );

    if (tables.includes('faqs')) await qi.dropTable('faqs');
    if (tables.includes('faq_categories')) await qi.dropTable('faq_categories');
    if (tables.includes('support_messages')) await qi.dropTable('support_messages');
    if (tables.includes('support_tickets')) await qi.dropTable('support_tickets');
    if (tables.includes('platform_report_notes')) await qi.dropTable('platform_report_notes');
    if (tables.includes('platform_reports')) await qi.dropTable('platform_reports');

    const desc = tables.includes('reviews') ? await qi.describeTable('reviews') : {};
    if (desc.moderation_notes) await qi.removeColumn('reviews', 'moderation_notes');
    if (desc.flags_count) await qi.removeColumn('reviews', 'flags_count');
    if (desc.auto_flag_reasons) await qi.removeColumn('reviews', 'auto_flag_reasons');
    if (desc.last_auto_scan_at) await qi.removeColumn('reviews', 'last_auto_scan_at');
  },
};
