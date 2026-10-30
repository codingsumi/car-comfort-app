'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'stripe_connect_account_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'stripe_customer_id',
    });

    await queryInterface.addIndex('users', ['stripe_connect_account_id'], {
      name: 'users_stripe_connect_account_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'stripe_connect_account_id');
  },
};
