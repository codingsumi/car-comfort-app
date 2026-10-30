'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('provider_wallets', 'pending_balance', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'available_balance',
    });

    await queryInterface.addColumn('provider_wallets', 'available_for_payout', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'pending_balance',
    });

    await queryInterface.sequelize.query(
      `UPDATE provider_wallets
       SET pending_balance = available_balance,
           available_for_payout = 0`
    );

    await queryInterface.removeColumn('provider_wallets', 'available_balance');

    await queryInterface.changeColumn('provider_wallet_transactions', 'transaction_type', {
      type: Sequelize.ENUM(
        'booking_accept_credit',
        'booking_complete_release',
        'booking_cancel_reversal',
        'payout_debit',
        'adjustment_credit',
        'adjustment_debit',
        'reversal_debit'
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('provider_wallets', 'available_balance', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.sequelize.query(
      `UPDATE provider_wallets
       SET available_balance = pending_balance + available_for_payout`
    );

    await queryInterface.removeColumn('provider_wallets', 'available_for_payout');
    await queryInterface.removeColumn('provider_wallets', 'pending_balance');

    await queryInterface.changeColumn('provider_wallet_transactions', 'transaction_type', {
      type: Sequelize.ENUM(
        'booking_accept_credit',
        'payout_debit',
        'adjustment_credit',
        'adjustment_debit',
        'reversal_debit'
      ),
      allowNull: false,
    });
  },
};
