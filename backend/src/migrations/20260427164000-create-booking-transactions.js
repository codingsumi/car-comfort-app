'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_transaction_counters', {
      txn_date: {
        type: Sequelize.STRING(8), // YYYYMMDD
        allowNull: false,
        primaryKey: true
      },
      last_sequence: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('booking_transactions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      transaction_code: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      currency: {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: 'inr'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('requires_payment_method', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled'),
        allowNull: false
      },
      stripe_payment_intent_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      payment_method_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      stripe_payload: {
        type: Sequelize.JSON,
        allowNull: true
      },
      stripe_error: {
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('booking_transactions', ['booking_id']);
    await queryInterface.addIndex('booking_transactions', ['user_id']);
    await queryInterface.addIndex('booking_transactions', ['stripe_payment_intent_id']);
    await queryInterface.addIndex('booking_transactions', ['status']);

    await queryInterface.createTable('refund_requests', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      booking_transaction_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'booking_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('requested', 'approved', 'rejected', 'processing', 'refunded'),
        allowNull: false,
        defaultValue: 'requested'
      },
      stripe_refund_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      stripe_payload: {
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('refund_requests', ['booking_transaction_id']);
    await queryInterface.addIndex('refund_requests', ['user_id']);
    await queryInterface.addIndex('refund_requests', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('refund_requests');
    await queryInterface.dropTable('booking_transactions');
    await queryInterface.dropTable('booking_transaction_counters');
  }
};

