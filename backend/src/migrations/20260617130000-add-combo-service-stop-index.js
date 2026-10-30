'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('bookings');
    if (!table.combo_service_stop_index) {
      await queryInterface.addColumn('bookings', 'combo_service_stop_index', {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: '0 = first combo stop (EV charging), 1 = second stop (car wash)',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'combo_service_stop_index').catch(() => {});
  },
};
