'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bookings', 'schedule_type', {
      type: Sequelize.ENUM('asap', 'scheduled', 'on_demand'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET schedule_type = 'asap'
      WHERE schedule_type = 'on_demand'
    `);

    await queryInterface.changeColumn('bookings', 'schedule_type', {
      type: Sequelize.ENUM('asap', 'scheduled'),
      allowNull: true,
    });
  },
};
