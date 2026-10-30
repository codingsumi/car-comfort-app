'use strict';

/** Expose Stripe publishable key + mode to mobile apps via public settings / stripe-config API. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE app_settings SET is_public = 1 WHERE \`key\` IN ('stripe_publishable_key', 'stripe_payment_mode')`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE app_settings SET is_public = 0 WHERE \`key\` IN ('stripe_publishable_key', 'stripe_payment_mode')`
    );
  },
};
