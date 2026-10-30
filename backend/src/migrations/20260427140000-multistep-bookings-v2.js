'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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

    if (!tables.includes('booking_images')) {
      await queryInterface.createTable('booking_images', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'bookings', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        image_url: {
          type: Sequelize.STRING(2048),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }

    // Ensure index exists (safe if already created by FK or prior partial run)
    await queryInterface.addIndex('booking_images', ['booking_id']).catch(() => {});

    // Expand bookings table to support step-wise entity.
    const bookingCols = await queryInterface.describeTable('bookings');

    if (!bookingCols.address) {
      await queryInterface.addColumn('bookings', 'address', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!bookingCols.latitude) {
      await queryInterface.addColumn('bookings', 'latitude', { type: Sequelize.DECIMAL(10, 8), allowNull: true });
    }
    if (!bookingCols.longitude) {
      await queryInterface.addColumn('bookings', 'longitude', { type: Sequelize.DECIMAL(11, 8), allowNull: true });
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
    if (!bookingCols.vehicle_id) {
      await queryInterface.addColumn('bookings', 'vehicle_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'vehicles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!bookingCols.parking_instructions) {
      await queryInterface.addColumn('bookings', 'parking_instructions', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!bookingCols.notes) {
      await queryInterface.addColumn('bookings', 'notes', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!bookingCols.base_price) {
      await queryInterface.addColumn('bookings', 'base_price', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
    }
    if (!bookingCols.addon_price) {
      await queryInterface.addColumn('bookings', 'addon_price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });
    }
    if (!bookingCols.service_fee) {
      await queryInterface.addColumn('bookings', 'service_fee', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });
    }
    if (!bookingCols.total_price) {
      await queryInterface.addColumn('bookings', 'total_price', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
    }

    // Booking status enum expansion (MySQL requires raw alter).
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      MODIFY COLUMN status
        ENUM('draft','pending_payment','confirmed','assigned','in_progress','completed','cancelled')
        NOT NULL
        DEFAULT 'draft'
    `);

    // Existing rows (if any) should not suddenly become draft.
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET status = 'confirmed'
      WHERE status IN ('pending','confirmed','in_progress','completed','cancelled')
        AND status <> 'draft'
    `);

    await queryInterface.addIndex('bookings', ['service_location_id']).catch(() => {});
    await queryInterface.addIndex('bookings', ['vehicle_id']).catch(() => {});
    // status index already exists from the initial bookings migration in this repo
    await queryInterface.addIndex('bookings', ['status']).catch(() => {});

    // Seed service locations (seed-only, no CRUD yet). Only seed if empty.
    const [[{ c }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) AS c FROM service_locations`);
    if (Number(c) === 0) {
      await queryInterface.bulkInsert('service_locations', [
        {
          name: 'Koramangala Hub',
          address: 'Koramangala, Bengaluru, Karnataka',
          latitude: 12.935192,
          longitude: 77.62448
        },
        {
          name: 'Indiranagar Hub',
          address: 'Indiranagar, Bengaluru, Karnataka',
          latitude: 12.97837,
          longitude: 77.64084
        },
        {
          name: 'Whitefield Hub',
          address: 'Whitefield, Bengaluru, Karnataka',
          latitude: 12.9698,
          longitude: 77.75
        }
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('bookings', ['vehicle_id']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['service_location_id']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['status']).catch(() => {});

    await queryInterface.removeColumn('bookings', 'total_price').catch(() => {});
    await queryInterface.removeColumn('bookings', 'service_fee').catch(() => {});
    await queryInterface.removeColumn('bookings', 'addon_price').catch(() => {});
    await queryInterface.removeColumn('bookings', 'base_price').catch(() => {});

    await queryInterface.removeColumn('bookings', 'notes').catch(() => {});
    await queryInterface.removeColumn('bookings', 'parking_instructions').catch(() => {});
    await queryInterface.removeColumn('bookings', 'vehicle_id').catch(() => {});

    await queryInterface.removeColumn('bookings', 'service_location_id').catch(() => {});
    await queryInterface.removeColumn('bookings', 'longitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'latitude').catch(() => {});
    await queryInterface.removeColumn('bookings', 'address').catch(() => {});

    await queryInterface.dropTable('booking_images');
    await queryInterface.dropTable('service_locations');

    await queryInterface.sequelize.query(`
      ALTER TABLE bookings
      MODIFY COLUMN status ENUM('pending','confirmed','in_progress','completed','cancelled')
      NOT NULL
      DEFAULT 'pending'
    `);
  }
};

