'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('account_deletion_requests', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      role: {
        type: Sequelize.STRING(32),
        allowNull: true
      },
      name: {
        type: Sequelize.STRING(160),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(32),
        allowNull: true
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      source: {
        type: Sequelize.ENUM('app', 'public'),
        allowNull: false,
        defaultValue: 'app'
      },
      status: {
        type: Sequelize.ENUM('otp_pending', 'pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      otp_code: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      otp_expiry: {
        type: Sequelize.DATE,
        allowNull: true
      },
      otp_verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      processed_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      admin_note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      user_snapshot: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('account_deletion_requests', ['user_id']);
    await queryInterface.addIndex('account_deletion_requests', ['email']);
    await queryInterface.addIndex('account_deletion_requests', ['status', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('account_deletion_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_account_deletion_requests_source').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_account_deletion_requests_status').catch(() => {});
  }
};
