'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('bookings');

    if (!columns.test_archived_at) {
      await queryInterface.addColumn('bookings', 'test_archived_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!columns.test_archived_by) {
      await queryInterface.addColumn('bookings', 'test_archived_by', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('bookings');

    if (columns.test_archived_by) {
      await queryInterface.removeColumn('bookings', 'test_archived_by');
    }
    if (columns.test_archived_at) {
      await queryInterface.removeColumn('bookings', 'test_archived_at');
    }
  },
};
