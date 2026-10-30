'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('driver_profiles', 'approval_status', {
      type: Sequelize.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    });

    await queryInterface.addColumn('driver_profiles', 'approval_reason', {
      type: Sequelize.STRING(1024),
      allowNull: true
    });

    await queryInterface.addColumn('driver_profiles', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('driver_profiles', 'rejected_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('driver_profiles', 'rejected_at');
    await queryInterface.removeColumn('driver_profiles', 'approved_at');
    await queryInterface.removeColumn('driver_profiles', 'approval_reason');
    await queryInterface.removeColumn('driver_profiles', 'approval_status');

    // cleanup enum type on postgres only (noop on mysql)
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_driver_profiles_approval_status";');
    }
  }
};

