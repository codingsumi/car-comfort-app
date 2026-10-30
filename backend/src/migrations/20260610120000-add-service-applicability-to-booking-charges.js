'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('booking_charges');
    if (!table.service_applicability) {
      await queryInterface.addColumn('booking_charges', 'service_applicability', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'all',
        after: 'sort_order',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('booking_charges', 'service_applicability').catch(() => {});
  },
};
