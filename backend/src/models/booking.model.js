const { DataTypes } = require('sequelize');

const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];
const SCHEDULE_TYPES = ['asap', 'scheduled', 'on_demand'];
const BOOKING_STATUSES = [
  'draft',
  'pending_payment',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
  'disputed',
  'refunded'
];

module.exports = (sequelize) => {
  const Booking = sequelize.define(
    'Booking',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      customer_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      provider_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      assigned_driver_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      service_type: {
        type: DataTypes.ENUM(...SERVICE_TYPES),
        allowNull: false
      },
      package_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      // LOCATION
      address: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      service_address: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      service_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      service_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      service_location_name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },

      // EV charging (for ev_charging + combo)
      ev_charging_address: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      charging_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      charging_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      ev_charging_location_name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      charger_type: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      ev_account_card_on_file: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },

      custom_package_name: {
        type: DataTypes.STRING(160),
        allowNull: true
      },
      custom_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      schedule_type: {
        type: DataTypes.ENUM(...SCHEDULE_TYPES),
        allowNull: true
      },
      scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_datetime: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      service_lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      tracking_status: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      // VEHICLE
      vehicle_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      vehicle_charge_limit: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      current_battery_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      current_battery_status: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      rate_per_kw: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      // EXTRA
      parking_instructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      vehicle_parked_location: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      vehicle_parked_location_other: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      provider_park_location: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      provider_park_location_other: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      vehicle_key_location: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      vehicle_key_location_other: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      key_return_location: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      key_return_location_other: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // PRICING
      base_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      provider_compensation_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: true
      },
      provider_compensation_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      provider_compensation_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      on_demand_provider_compensation_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      on_demand_provider_compensation_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: true
      },
      on_demand_provider_compensation_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      service_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      base_price_before_discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      referral_discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      referral_discount_type: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      promotional_discount_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      },
      promotional_discount_name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      promotional_discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      platform_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      convenience_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      on_demand_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      towing_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      price_summary: {
        type: DataTypes.JSON,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM(...BOOKING_STATUSES),
        allowNull: false,
        defaultValue: 'draft'
      },
      booking_code: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancelled_by: {
        // 'customer' | 'driver' | 'admin' (string for forward-compat)
        type: DataTypes.STRING(32),
        allowNull: true
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cancellation_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      provider_cancellation_share_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      dispute_status: {
        type: DataTypes.ENUM('open', 'investigating', 'resolved', 'closed'),
        allowNull: true,
        defaultValue: null
      },
      admin_cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pickup_otp: {
        type: DataTypes.STRING(6),
        allowNull: true
      },
      pickup_otp_expiry: {
        type: DataTypes.DATE,
        allowNull: true
      },
      driver_accepted_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      driver_arrived_customer_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      on_demand_accept_deadline_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      arrival_wait_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      scheduled_pickup_window_start_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      scheduled_pickup_deadline_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_timer_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      service_duration_minutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      actual_service_duration_minutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      driver_started_to_service_center_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      combo_service_stop_index: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      test_archived_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      test_archived_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
      }
    },
    {
      tableName: 'bookings',
      underscored: true,
      hooks: {
        beforeSave(instance) {
          const uid = instance.get('user_id');
          if (uid != null) instance.setDataValue('customer_id', uid);

          const driverId = instance.get('assigned_driver_user_id');
          if (driverId != null) instance.setDataValue('provider_id', driverId);

          const sched = instance.get('scheduled_at');
          if (sched) instance.setDataValue('service_datetime', sched);

          const sLat = instance.get('service_latitude');
          const sLng = instance.get('service_longitude');
          const lat = instance.get('latitude');
          const lng = instance.get('longitude');
          if (sLat != null || lat != null) {
            instance.setDataValue('service_lat', sLat != null ? sLat : lat);
          }
          if (sLng != null || lng != null) {
            instance.setDataValue('service_lng', sLng != null ? sLng : lng);
          }
        }
      }
    }
  );

  return Booking;
};
