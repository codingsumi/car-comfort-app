'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('bookings');

    if (!tableDesc.pickup_otp) {
      await queryInterface.addColumn('bookings', 'pickup_otp', {
        type: Sequelize.STRING(6),
        allowNull: true
      });
    }

    if (!tableDesc.pickup_otp_expiry) {
      await queryInterface.addColumn('bookings', 'pickup_otp_expiry', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'pickup_otp_expiry');
    await queryInterface.removeColumn('bookings', 'pickup_otp');
  }
};
