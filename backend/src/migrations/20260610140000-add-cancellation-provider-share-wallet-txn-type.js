'use strict';

const WALLET_TRANSACTION_TYPES = [
  'booking_accept_credit',
  'booking_service_start_advance',
  'booking_complete_release',
  'booking_complete_balance',
  'booking_cancel_reversal',
  'booking_tip_credit',
  'cancellation_provider_share',
  'payout_debit',
  'adjustment_credit',
  'adjustment_debit',
  'reversal_debit',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('provider_wallet_transactions', 'transaction_type', {
      type: require('sequelize').ENUM(...WALLET_TRANSACTION_TYPES),
      allowNull: false,
    });
  },

  async down(queryInterface) {
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
};
