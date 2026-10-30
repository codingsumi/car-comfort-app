'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('users');

    // MySQL DDL can persist a prior column before a later statement fails.
    // Check each column independently so rerunning this migration is safe.
    if (!columns.stripe_test_publishable_key) {
      await queryInterface.addColumn('users', 'stripe_test_publishable_key', {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }

    if (!columns.stripe_test_secret_key) {
      await queryInterface.addColumn('users', 'stripe_test_secret_key', {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('users');

    if (columns.stripe_test_publishable_key) {
      await queryInterface.removeColumn('users', 'stripe_test_publishable_key');
    }
    if (columns.stripe_test_secret_key) {
      await queryInterface.removeColumn('users', 'stripe_test_secret_key');
    }
  },
};
