'use strict';

/** Extend bookings safely; create driver_locations, notification_logs, notification_state. */

module.exports = {
  async up(queryInterface, Sequelize) {
    const bookings = await queryInterface.describeTable('bookings');

    if (!bookings.customer_id) {
      await queryInterface.addColumn('bookings', 'customer_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!bookings.provider_id) {
      await queryInterface.addColumn('bookings', 'provider_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!bookings.service_datetime) {
      await queryInterface.addColumn('bookings', 'service_datetime', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!bookings.service_lat) {
      await queryInterface.addColumn('bookings', 'service_lat', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
    }

    if (!bookings.service_lng) {
      await queryInterface.addColumn('bookings', 'service_lng', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
    }

    /**
     * Day-of-service / en-route lifecycle parallel to bookings.status (lifecycle / payment states).
     * Values: scheduled | enroute | arrived | completed (see app validation).
     */
    if (!bookings.tracking_status) {
      await queryInterface.addColumn('bookings', 'tracking_status', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET customer_id = user_id
      WHERE customer_id IS NULL AND user_id IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET provider_id = assigned_driver_user_id
      WHERE provider_id IS NULL AND assigned_driver_user_id IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET service_datetime = scheduled_at
      WHERE service_datetime IS NULL AND scheduled_at IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET service_lat = COALESCE(service_latitude, latitude)
      WHERE service_lat IS NULL AND (service_latitude IS NOT NULL OR latitude IS NOT NULL)
    `);
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET service_lng = COALESCE(service_longitude, longitude)
      WHERE service_lng IS NULL AND (service_longitude IS NOT NULL OR longitude IS NOT NULL)
    `);

    await queryInterface.addIndex('bookings', ['customer_id']).catch(() => {});
    await queryInterface.addIndex('bookings', ['provider_id']).catch(() => {});
    await queryInterface.addIndex('bookings', ['service_datetime']).catch(() => {});
    await queryInterface.addIndex('bookings', ['tracking_status']).catch(() => {});

    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    const hasDriverLocs = tables.includes('driver_locations');
    if (!hasDriverLocs) {
      await queryInterface.createTable('driver_locations', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        provider_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'bookings', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        lat: { type: Sequelize.DECIMAL(10, 8), allowNull: false },
        lng: { type: Sequelize.DECIMAL(11, 8), allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      await queryInterface.addIndex('driver_locations', ['booking_id'], { name: 'idx_driver_locations_booking_id' });
      await queryInterface.addIndex('driver_locations', ['created_at'], { name: 'idx_driver_locations_created_at' });
      await queryInterface.addIndex(
        'driver_locations',
        ['booking_id', 'created_at'],
        { name: 'idx_driver_locations_booking_created' }
      );
    }

    const hasNotifLogs = tables.includes('notification_logs');
    if (!hasNotifLogs) {
      await queryInterface.createTable('notification_logs', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'bookings', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.STRING(32),
          allowNull: false,
          comment: 'SERVICE_DAY, REMINDER, ENROUTE_UPDATE, ARRIVED'
        },
        unique_key: { type: Sequelize.STRING(190), allowNull: false },
        meta: { type: Sequelize.JSON, allowNull: true },
        status: { type: Sequelize.STRING(16), allowNull: false },
        sent_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      await queryInterface.addConstraint('notification_logs', {
        fields: ['unique_key'],
        type: 'unique',
        name: 'uq_notification_logs_unique_key'
      });
      await queryInterface.addIndex('notification_logs', ['booking_id'], { name: 'idx_notification_logs_booking_id' });
    }

    const hasNotifState = tables.includes('notification_state');
    if (!hasNotifState) {
      await queryInterface.createTable('notification_state', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        booking_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'bookings', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        enroute_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        last_notified_at: { type: Sequelize.DATE, allowNull: true },
        last_distance_bucket: { type: Sequelize.STRING(32), allowNull: true }
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notification_state').catch(() => {});
    await queryInterface.dropTable('notification_logs').catch(() => {});
    await queryInterface.dropTable('driver_locations').catch(() => {});

    const bookings = await queryInterface.describeTable('bookings');
    await queryInterface.removeIndex('bookings', ['tracking_status']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['service_datetime']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['provider_id']).catch(() => {});
    await queryInterface.removeIndex('bookings', ['customer_id']).catch(() => {});

    if (bookings.tracking_status) await queryInterface.removeColumn('bookings', 'tracking_status');
    if (bookings.service_lng) await queryInterface.removeColumn('bookings', 'service_lng');
    if (bookings.service_lat) await queryInterface.removeColumn('bookings', 'service_lat');
    if (bookings.service_datetime) await queryInterface.removeColumn('bookings', 'service_datetime');
    if (bookings.provider_id) await queryInterface.removeColumn('bookings', 'provider_id');
    if (bookings.customer_id) await queryInterface.removeColumn('bookings', 'customer_id');
  }
};
