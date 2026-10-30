'use strict';

/** Allow multiple providers on the same booking (e.g. no-show → reassignment). */
module.exports = {
  async up(queryInterface) {
    await queryInterface
      .removeConstraint('provider_wallet_transactions', 'uniq_provider_wallet_booking_type')
      .catch(() => {});

    await queryInterface.addConstraint('provider_wallet_transactions', {
      fields: ['booking_id', 'transaction_type', 'provider_id'],
      type: 'unique',
      name: 'uniq_provider_wallet_booking_type_provider',
    });
  },

  async down(queryInterface) {
    await queryInterface
      .removeConstraint('provider_wallet_transactions', 'uniq_provider_wallet_booking_type_provider')
      .catch(() => {});

    await queryInterface.addConstraint('provider_wallet_transactions', {
      fields: ['booking_id', 'transaction_type'],
      type: 'unique',
      name: 'uniq_provider_wallet_booking_type',
    });
  },
};
