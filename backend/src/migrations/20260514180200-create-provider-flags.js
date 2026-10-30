'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_flags', {
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
      flag_type: {
        type: Sequelize.ENUM('low_rating', 'high_cancellation', 'high_complaints', 'excessive_disputes', 'late_arrivals', 'manual'),
        allowNull: false,
      },
      severity: {
        type: Sequelize.ENUM('warning', 'critical'),
        allowNull: false,
        defaultValue: 'warning',
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      resolved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      resolved_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolution_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      flagged_by: {
        type: Sequelize.ENUM('system', 'admin'),
        allowNull: false,
        defaultValue: 'system',
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

    await queryInterface.addIndex('provider_flags', ['provider_id']);
    await queryInterface.addIndex('provider_flags', ['flag_type']);
    await queryInterface.addIndex('provider_flags', ['resolved']);
    await queryInterface.addIndex('provider_flags', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('provider_flags');
  },
};
