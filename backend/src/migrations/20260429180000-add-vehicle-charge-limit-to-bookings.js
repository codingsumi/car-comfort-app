'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('bookings');
    if (cols.vehicle_charge_limit) return;

    await queryInterface.addColumn('bookings', 'vehicle_charge_limit', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'vehicle_charge_limit').catch(() => {});
  }
};

