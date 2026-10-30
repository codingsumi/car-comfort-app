'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('users');

    if (!tableDesc.stripe_customer_id_live) {
      await queryInterface.addColumn('users', 'stripe_customer_id_live', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
        after: 'stripe_customer_id',
      });
    }

    if (!tableDesc.stripe_customer_id_test) {
      await queryInterface.addColumn('users', 'stripe_customer_id_test', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
        after: 'stripe_customer_id_live',
      });
    }

    // Backfill: copy existing stripe_customer_id into the correct mode column.
    // Customers starting with cus_ and created before mode separation go into test
    // (since the system was in test mode). Live customers will be created fresh.
    await queryInterface.sequelize.query(`
      UPDATE users
      SET stripe_customer_id_test = stripe_customer_id
      WHERE stripe_customer_id IS NOT NULL
        AND stripe_customer_id != ''
        AND (stripe_customer_id_test IS NULL OR stripe_customer_id_test = '')
    `);
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('users');
    if (tableDesc.stripe_customer_id_live) {
      await queryInterface.removeColumn('users', 'stripe_customer_id_live');
    }
    if (tableDesc.stripe_customer_id_test) {
      await queryInterface.removeColumn('users', 'stripe_customer_id_test');
    }
  },
};
