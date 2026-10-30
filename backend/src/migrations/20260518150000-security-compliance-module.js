'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('admin_audit_logs', 'actor_type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'admin',
    });
    await queryInterface.addColumn('admin_audit_logs', 'module', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('admin_audit_logs', 'severity', {
      type: Sequelize.ENUM('info', 'low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'info',
    });
    await queryInterface.addColumn('admin_audit_logs', 'device_info', {
      type: Sequelize.STRING(512),
      allowNull: true,
    });
    await queryInterface.addColumn('admin_audit_logs', 'old_values', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('admin_audit_logs', 'new_values', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.changeColumn('admin_audit_logs', 'entity_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addIndex('admin_audit_logs', ['module'], { name: 'idx_audit_module' });
    await queryInterface.addIndex('admin_audit_logs', ['severity'], { name: 'idx_audit_severity' });

    await queryInterface.createTable('admin_sessions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      admin_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      device_info: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      login_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_activity_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      revoked_at: {
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
    await queryInterface.addIndex('admin_sessions', ['admin_id'], { name: 'idx_admin_sessions_admin' });
    await queryInterface.addIndex('admin_sessions', ['is_revoked', 'last_activity_at'], {
      name: 'idx_admin_sessions_active',
    });

    await queryInterface.createTable('auth_events', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email_attempt: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      event_type: {
        type: Sequelize.ENUM('login_success', 'login_failed', 'logout', 'password_reset', 'password_change'),
        allowNull: false,
      },
      actor_type: {
        type: Sequelize.ENUM('admin', 'customer', 'driver', 'garage', 'system'),
        allowNull: false,
        defaultValue: 'admin',
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      device_info: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('auth_events', ['event_type', 'created_at'], { name: 'idx_auth_events_type_time' });
    await queryInterface.addIndex('auth_events', ['user_id'], { name: 'idx_auth_events_user' });
    await queryInterface.addIndex('auth_events', ['ip_address'], { name: 'idx_auth_events_ip' });

    await queryInterface.createTable('compliance_requests', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      request_type: {
        type: Sequelize.ENUM('account_deletion', 'data_export', 'data_anonymization', 'consent_update'),
        allowNull: false,
      },
      request_status: {
        type: Sequelize.ENUM('pending', 'verified', 'processing', 'completed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      deletion_type: {
        type: Sequelize.ENUM('soft_delete', 'permanent_delete', 'anonymization'),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      export_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      processed_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      processed_at: {
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
    await queryInterface.addIndex('compliance_requests', ['request_status'], { name: 'idx_compliance_status' });
    await queryInterface.addIndex('compliance_requests', ['user_id'], { name: 'idx_compliance_user' });

    await queryInterface.createTable('security_alerts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      alert_type: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      entity_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('open', 'investigating', 'resolved'),
        allowNull: false,
        defaultValue: 'open',
      },
      recommended_action: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      resolved_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      resolved_at: {
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
    await queryInterface.addIndex('security_alerts', ['status', 'severity'], { name: 'idx_security_alerts_status' });
    await queryInterface.addIndex('security_alerts', ['alert_type'], { name: 'idx_security_alerts_type' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('security_alerts');
    await queryInterface.dropTable('compliance_requests');
    await queryInterface.dropTable('auth_events');
    await queryInterface.dropTable('admin_sessions');

    await queryInterface.removeIndex('admin_audit_logs', 'idx_audit_severity');
    await queryInterface.removeIndex('admin_audit_logs', 'idx_audit_module');
    await queryInterface.removeColumn('admin_audit_logs', 'new_values');
    await queryInterface.removeColumn('admin_audit_logs', 'old_values');
    await queryInterface.removeColumn('admin_audit_logs', 'device_info');
    await queryInterface.removeColumn('admin_audit_logs', 'severity');
    await queryInterface.removeColumn('admin_audit_logs', 'module');
    await queryInterface.removeColumn('admin_audit_logs', 'actor_type');

    await queryInterface.changeColumn('admin_audit_logs', 'entity_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false,
    });
  },
};
