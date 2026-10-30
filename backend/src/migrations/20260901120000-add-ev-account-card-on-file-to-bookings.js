'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');
    if (!bookingCols.ev_account_card_on_file) {
      await queryInterface.addColumn('bookings', 'ev_account_card_on_file', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'ev_account_card_on_file').catch(() => {});
  },
};
