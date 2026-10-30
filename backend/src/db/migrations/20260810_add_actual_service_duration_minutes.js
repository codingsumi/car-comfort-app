'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'actual_service_duration_minutes', {
      type: Sequelize.DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Measured elapsed service duration (service_started_at → service_completed_at). Set by finalizeServiceDurationTimer.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'actual_service_duration_minutes');
  },
};
