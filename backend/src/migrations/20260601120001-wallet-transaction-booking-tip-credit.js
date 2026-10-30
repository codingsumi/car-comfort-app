'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('provider_wallet_transactions', 'transaction_type', {
      type: require('sequelize').ENUM(
        'booking_accept_credit',
        'booking_complete_release',
        'booking_cancel_reversal',
        'booking_tip_credit',
        'payout_debit',
        'adjustment_credit',
        'adjustment_debit',
        'reversal_debit'
      ),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn('provider_wallet_transactions', 'transaction_type', {
      type: require('sequelize').ENUM(
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
};
