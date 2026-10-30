'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vacuum_penalties', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      provider_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      penalty_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      deduction_type: {
        type: Sequelize.ENUM('fixed', 'percentage'),
        allowNull: false,
        defaultValue: 'fixed',
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      evidence_urls: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      issued_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('pending', 'applied', 'reversed'),
        allowNull: false,
        defaultValue: 'applied',
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

    await queryInterface.addIndex('vacuum_penalties', ['provider_id']);
    await queryInterface.addIndex('vacuum_penalties', ['booking_id']);
    await queryInterface.addIndex('vacuum_penalties', ['issued_by']);
    await queryInterface.addIndex('vacuum_penalties', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vacuum_penalties');
  },
};
