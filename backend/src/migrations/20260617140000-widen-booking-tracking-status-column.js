'use strict';

/** Combo tracking codes like DRIVER_HEADING_TO_NEXT_SERVICE_STOP exceed VARCHAR(32). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bookings', 'tracking_status', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bookings', 'tracking_status', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
  },
};
