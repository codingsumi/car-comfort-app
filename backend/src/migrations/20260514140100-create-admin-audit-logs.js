'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_audit_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      admin_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      action_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
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

    await queryInterface.addIndex('admin_audit_logs', ['admin_id'], { name: 'idx_audit_admin_id' });
    await queryInterface.addIndex('admin_audit_logs', ['entity_type', 'entity_id'], { name: 'idx_audit_entity' });
    await queryInterface.addIndex('admin_audit_logs', ['action_type'], { name: 'idx_audit_action_type' });
    await queryInterface.addIndex('admin_audit_logs', ['created_at'], { name: 'idx_audit_created_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_audit_logs');
  },
};
