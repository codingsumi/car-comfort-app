'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.stripe_customer_id) {
      await queryInterface.addColumn('users', 'stripe_customer_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    if (!table.default_payment_method_id) {
      await queryInterface.addColumn('users', 'default_payment_method_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    // Add a partial unique index if supported; skip if it already exists.
    // Some MySQL variants may not support partial indexes the same way; best-effort only.
    try {
      await queryInterface.addIndex('users', ['stripe_customer_id'], {
        unique: true,
        name: 'users_stripe_customer_id_unique',
        where: { stripe_customer_id: { [Sequelize.Op.ne]: null } }
      });
    } catch (_e) {
      // ignore if index already exists or partial indexes unsupported
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('users', 'users_stripe_customer_id_unique');
    } catch (_e) {
      // ignore
    }

    const table = await queryInterface.describeTable('users');
    if (table.default_payment_method_id) {
      await queryInterface.removeColumn('users', 'default_payment_method_id');
    }
    if (table.stripe_customer_id) {
      await queryInterface.removeColumn('users', 'stripe_customer_id');
    }
  }
};

