'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    const bookingCols = await queryInterface.describeTable('bookings');

    // Drop FK/index/column if it exists.
    if (bookingCols.service_location_id) {
      await queryInterface.removeIndex('bookings', ['service_location_id']).catch(() => {});
      await queryInterface.removeColumn('bookings', 'service_location_id');
    }

    // Drop service_locations table if it exists.
    if (tables.includes('service_locations')) {
      await queryInterface.dropTable('service_locations');
    }
  },

  async down(queryInterface, Sequelize) {
    const bookingCols = await queryInterface.describeTable('bookings');

    // Recreate table (minimal) and column (nullable), so rollback works.
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (!tables.includes('service_locations')) {
      await queryInterface.createTable('service_locations', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING(160),
          allowNull: false
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        latitude: {
          type: Sequelize.DECIMAL(10, 8),
          allowNull: false
        },
        longitude: {
          type: Sequelize.DECIMAL(11, 8),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
    }

    if (!bookingCols.service_location_id) {
      await queryInterface.addColumn('bookings', 'service_location_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'service_locations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    await queryInterface.addIndex('bookings', ['service_location_id']).catch(() => {});
  }
};

