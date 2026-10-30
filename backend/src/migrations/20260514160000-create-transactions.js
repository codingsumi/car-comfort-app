'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      transaction_code: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      booking_transaction_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'booking_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      customer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      provider_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      transaction_type: {
        type: Sequelize.ENUM(
          'booking_payment',
          'refund',
          'partial_refund',
          'provider_payout',
          'adjustment',
          'manual_payout',
          'commission_deduction'
        ),
        allowNull: false,
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      stripe_payment_intent_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      stripe_charge_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      stripe_transfer_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      stripe_refund_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commission_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      provider_earning: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      tax_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      refund_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      net_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'processing',
          'succeeded',
          'failed',
          'refunded',
          'partially_refunded'
        ),
        allowNull: false,
        defaultValue: 'pending',
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
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('transactions', ['booking_id']);
    await queryInterface.addIndex('transactions', ['booking_transaction_id']);
    await queryInterface.addIndex('transactions', ['customer_id']);
    await queryInterface.addIndex('transactions', ['provider_id']);
    await queryInterface.addIndex('transactions', ['status']);
    await queryInterface.addIndex('transactions', ['transaction_type']);
    await queryInterface.addIndex('transactions', ['created_at']);
    await queryInterface.addIndex('transactions', ['stripe_payment_intent_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transactions');
  },
};
