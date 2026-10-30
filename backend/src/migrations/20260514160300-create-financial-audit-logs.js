'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('financial_audit_logs', {
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
      action: {
        type: Sequelize.ENUM(
          'manual_payout',
          'refund_processed',
          'pricing_created',
          'pricing_updated',
          'pricing_deleted',
          'commission_changed',
          'deduction_applied'
        ),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      previous_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('financial_audit_logs', ['admin_id']);
    await queryInterface.addIndex('financial_audit_logs', ['action']);
    await queryInterface.addIndex('financial_audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('financial_audit_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('financial_audit_logs');
  },
};
