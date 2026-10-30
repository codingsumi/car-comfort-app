'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('provider_wallet_transactions', 'ledger_type', {
      type: Sequelize.ENUM('credit', 'debit'),
      allowNull: true,
      after: 'transaction_type',
    });

    await queryInterface.addColumn('provider_wallet_transactions', 'status', {
      type: Sequelize.ENUM('pending', 'completed', 'failed'),
      allowNull: true,
      defaultValue: 'completed',
      after: 'ledger_type',
    });

    await queryInterface.addColumn('provider_wallet_transactions', 'provider_payout_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'provider_payouts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'booking_id',
    });

    await queryInterface.sequelize.query(`
      UPDATE provider_wallet_transactions
      SET ledger_type = CASE
        WHEN transaction_type IN ('booking_accept_credit', 'booking_complete_release', 'adjustment_credit') THEN 'credit'
        ELSE 'debit'
      END,
      status = CASE
        WHEN transaction_type = 'booking_accept_credit' THEN 'pending'
        WHEN transaction_type = 'payout_debit' THEN 'pending'
        ELSE 'completed'
      END
      WHERE ledger_type IS NULL
    `);

    await queryInterface.changeColumn('provider_wallet_transactions', 'ledger_type', {
      type: Sequelize.ENUM('credit', 'debit'),
      allowNull: false,
    });

    await queryInterface.changeColumn('provider_wallet_transactions', 'status', {
      type: Sequelize.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'completed',
    });

    await queryInterface.addColumn('provider_payouts', 'initiated_by', {
      type: Sequelize.ENUM('admin', 'driver'),
      allowNull: false,
      defaultValue: 'admin',
      after: 'provider_id',
    });

    await queryInterface.addIndex('provider_wallet_transactions', ['ledger_type'], {
      name: 'idx_wallet_txn_ledger_type',
    });
    await queryInterface.addIndex('provider_wallet_transactions', ['status'], {
      name: 'idx_wallet_txn_status',
    });
    await queryInterface.addIndex('provider_wallet_transactions', ['provider_payout_id'], {
      name: 'idx_wallet_txn_payout_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('provider_wallet_transactions', 'idx_wallet_txn_payout_id');
    await queryInterface.removeIndex('provider_wallet_transactions', 'idx_wallet_txn_status');
    await queryInterface.removeIndex('provider_wallet_transactions', 'idx_wallet_txn_ledger_type');
    await queryInterface.removeColumn('provider_payouts', 'initiated_by');
    await queryInterface.removeColumn('provider_wallet_transactions', 'provider_payout_id');
    await queryInterface.removeColumn('provider_wallet_transactions', 'status');
    await queryInterface.removeColumn('provider_wallet_transactions', 'ledger_type');
  },
};
