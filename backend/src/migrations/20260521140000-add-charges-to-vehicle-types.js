'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('vehicle_types', 'charges', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('vehicle_types', 'charges').catch(() => {});
  },
};
