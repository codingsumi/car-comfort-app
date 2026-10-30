'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analytics_cache', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      metric_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      metric_value: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      filters_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('analytics_cache', ['metric_type', 'date', 'filters_hash'], {
      name: 'idx_analytics_cache_lookup',
      unique: true,
    });
    await queryInterface.addIndex('analytics_cache', ['generated_at'], {
      name: 'idx_analytics_cache_generated',
    });

    await queryInterface.createTable('export_jobs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      report_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      export_format: {
        type: Sequelize.ENUM('csv', 'xlsx'),
        allowNull: false,
        defaultValue: 'csv',
      },
      filters: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      generated_file_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      requested_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      row_count: {
        type: Sequelize.INTEGER.UNSIGNED,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('export_jobs', ['requested_by'], { name: 'idx_export_jobs_admin' });
    await queryInterface.addIndex('export_jobs', ['status'], { name: 'idx_export_jobs_status' });
    await queryInterface.addIndex('export_jobs', ['created_at'], { name: 'idx_export_jobs_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('export_jobs');
    await queryInterface.dropTable('analytics_cache');
  },
};
