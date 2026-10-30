'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'suspended', 'deactivated'),
      allowNull: false,
      defaultValue: 'active',
      after: 'role',
    });

    await queryInterface.addColumn('users', 'suspended_reason', {
      type: Sequelize.STRING(1024),
      allowNull: true,
      after: 'status',
    });

    await queryInterface.addColumn('users', 'suspended_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'suspended_reason',
    });

    await queryInterface.addColumn('users', 'deactivated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'suspended_at',
    });

    await queryInterface.addColumn('driver_profiles', 'approved_by', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      after: 'approved_at',
    });

    await queryInterface.addColumn('driver_profiles', 'insurance_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'approved_by',
    });

    await queryInterface.addIndex('users', ['status'], { name: 'idx_users_status' });
    await queryInterface.addIndex('users', ['role', 'status'], { name: 'idx_users_role_status' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_role_status');
    await queryInterface.removeIndex('users', 'idx_users_status');
    await queryInterface.removeColumn('driver_profiles', 'insurance_verified');
    await queryInterface.removeColumn('driver_profiles', 'approved_by');
    await queryInterface.removeColumn('users', 'deactivated_at');
    await queryInterface.removeColumn('users', 'suspended_at');
    await queryInterface.removeColumn('users', 'suspended_reason');
    await queryInterface.removeColumn('users', 'status');
  },
};
