'use strict';

const { DataTypes } = require('sequelize');

/**
 * Idempotent safety net when production DB is behind code.
 * Full migrations should still be run via `npm run db:migrate:prod` on deploy.
 */
async function ensureBookingEvColumns(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const bookingCols = await queryInterface.describeTable('bookings');

  if (!bookingCols.charger_type) {
    await queryInterface.addColumn('bookings', 'charger_type', {
      type: DataTypes.STRING(32),
      allowNull: true,
    });
  }

  if (!bookingCols.ev_account_card_on_file) {
    await queryInterface.addColumn('bookings', 'ev_account_card_on_file', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    });
  }

  if (!bookingCols.current_battery_status) {
    await queryInterface.addColumn('bookings', 'current_battery_status', {
      type: DataTypes.STRING(32),
      allowNull: true,
    });
  }

  if (!bookingCols.scheduled_pickup_window_start_at) {
    await queryInterface.addColumn('bookings', 'scheduled_pickup_window_start_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!bookingCols.scheduled_pickup_deadline_at) {
    await queryInterface.addColumn('bookings', 'scheduled_pickup_deadline_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!bookingCols.service_started_at) {
    await queryInterface.addColumn('bookings', 'service_started_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!bookingCols.service_timer_expires_at) {
    await queryInterface.addColumn('bookings', 'service_timer_expires_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!bookingCols.service_completed_at) {
    await queryInterface.addColumn('bookings', 'service_completed_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  if (!bookingCols.service_duration_minutes) {
    await queryInterface.addColumn('bookings', 'service_duration_minutes', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    });
  }

  if (!bookingCols.scheduled_at) {
    await queryInterface.addColumn('bookings', 'scheduled_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    bookingCols.scheduled_at = true;
    if (bookingCols.service_datetime) {
      await sequelize.query(`
        UPDATE bookings
        SET scheduled_at = service_datetime
        WHERE scheduled_at IS NULL AND service_datetime IS NOT NULL
      `);
    }
  }

  if (!bookingCols.service_datetime) {
    await queryInterface.addColumn('bookings', 'service_datetime', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    bookingCols.service_datetime = true;
    if (bookingCols.scheduled_at) {
      await sequelize.query(`
        UPDATE bookings
        SET service_datetime = scheduled_at
        WHERE service_datetime IS NULL AND scheduled_at IS NOT NULL
      `);
    }
  }

  const addString = async (name, length = 64) => {
    if (!bookingCols[name]) {
      await queryInterface.addColumn('bookings', name, {
        type: DataTypes.STRING(length),
        allowNull: true,
      });
      bookingCols[name] = true;
    }
  };

  const addText = async (name) => {
    if (!bookingCols[name]) {
      await queryInterface.addColumn('bookings', name, {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      bookingCols[name] = true;
    }
  };

  await addString('vehicle_parked_location');
  await addString('provider_park_location');
  await addString('vehicle_key_location');
  await addString('key_return_location');
  await addText('vehicle_parked_location_other');
  await addText('provider_park_location_other');
  await addText('vehicle_key_location_other');
  await addText('key_return_location_other');
  await addString('service_location_name', 255);
  await addString('ev_charging_location_name', 255);

  if (!bookingCols.combo_service_stop_index) {
    await queryInterface.addColumn('bookings', 'combo_service_stop_index', {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (bookingCols.tracking_status) {
    const rawType = String(bookingCols.tracking_status.type || '').toLowerCase();
    const match = rawType.match(/varchar\((\d+)\)/);
    const width = match ? Number.parseInt(match[1], 10) : 0;
    if (width > 0 && width < 64) {
      await queryInterface.changeColumn('bookings', 'tracking_status', {
        type: DataTypes.STRING(64),
        allowNull: true,
      });
    }
  }
}

module.exports = {
  ensureBookingEvColumns,
};
