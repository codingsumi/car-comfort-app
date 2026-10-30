'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('booking_transactions');
    if (!cols.currency) return;

    // Ensure new rows default to USD.
    await queryInterface.changeColumn('booking_transactions', 'currency', {
      type: Sequelize.STRING(8),
      allowNull: false,
      defaultValue: 'usd'
    });
  },

  async down(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('booking_transactions');
    if (!cols.currency) return;

    await queryInterface.changeColumn('booking_transactions', 'currency', {
      type: Sequelize.STRING(8),
      allowNull: false,
      defaultValue: 'inr'
    });
  }
};

