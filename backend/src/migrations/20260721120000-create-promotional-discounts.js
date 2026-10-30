'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotional_discounts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      discount_type: {
        type: Sequelize.ENUM('percentage', 'flat'),
        allowNull: false,
        defaultValue: 'percentage',
      },
      discount_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      // which service types this applies to — JSON array e.g. ["car_wash","ev_charging","combo"] or null = all
      applicable_services: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      // who can use it: 'all' | 'new_customers'
      audience: {
        type: Sequelize.ENUM('all', 'new_customers'),
        allowNull: false,
        defaultValue: 'all',
      },
      // recurrence: 'one_time' | 'weekly' | 'monthly'
      recurrence: {
        type: Sequelize.ENUM('one_time', 'weekly', 'monthly'),
        allowNull: false,
        defaultValue: 'one_time',
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      // status managed manually + auto-expired by backend
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'scheduled', 'expired'),
        allowNull: false,
        defaultValue: 'inactive',
      },
      max_uses: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'null = unlimited',
      },
      uses_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('promotional_discounts', ['status']);
    await queryInterface.addIndex('promotional_discounts', ['start_date', 'end_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('promotional_discounts');
  },
};
