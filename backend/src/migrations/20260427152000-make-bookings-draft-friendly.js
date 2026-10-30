'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Multi-step flow creates draft bookings before service details exist.
    await queryInterface.changeColumn('bookings', 'schedule_type', {
      type: Sequelize.ENUM('asap', 'scheduled'),
      allowNull: true
    });

    // Existing rows should have schedule_type; keep them unchanged.
  },

  async down(queryInterface, Sequelize) {
    // If rolling back, default missing schedule_type to 'asap' then enforce NOT NULL.
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET schedule_type = 'asap'
      WHERE schedule_type IS NULL
    `);

    await queryInterface.changeColumn('bookings', 'schedule_type', {
      type: Sequelize.ENUM('asap', 'scheduled'),
      allowNull: false
    });
  }
};

