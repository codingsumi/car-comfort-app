'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('booking_tracking_logs')) return;

    await queryInterface.createTable('booking_tracking_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      booking_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tracking_status: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      message: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('booking_tracking_logs', ['booking_id', 'created_at'], {
      name: 'idx_tracking_logs_booking_timeline'
    });

    await queryInterface.addIndex('booking_tracking_logs', ['tracking_status'], {
      name: 'idx_tracking_logs_status'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_tracking_logs');
  }
};
