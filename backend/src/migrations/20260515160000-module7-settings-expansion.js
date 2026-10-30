'use strict';

const newSettings = [
  // General extensions
  { key: 'app_description', value: 'Premium car wash and EV charging on demand', type: 'text', group_name: 'general', label: 'App Description', description: 'Short description of the platform', is_sensitive: false, is_public: true, sort_order: 10 },
  { key: 'date_format', value: 'MM/DD/YYYY', type: 'text', group_name: 'general', label: 'Date Format', description: 'Default date display format', is_sensitive: false, is_public: true, sort_order: 11 },
  { key: 'time_format', value: '12h', type: 'text', group_name: 'general', label: 'Time Format', description: '12h or 24h time display', is_sensitive: false, is_public: true, sort_order: 12 },

  // Maintenance
  { key: 'maintenance_mode_enabled', value: 'false', type: 'boolean', group_name: 'maintenance', label: 'Maintenance Mode', description: 'Block customer and provider apps when enabled', is_sensitive: false, is_public: true, sort_order: 1 },
  { key: 'maintenance_message', value: 'We are currently performing scheduled maintenance. Please check back soon.', type: 'text', group_name: 'maintenance', label: 'Maintenance Message', description: 'Message shown to users during maintenance', is_sensitive: false, is_public: true, sort_order: 2 },
  { key: 'maintenance_expected_return', value: '', type: 'text', group_name: 'maintenance', label: 'Expected Return Time', description: 'When service is expected to resume (ISO datetime or text)', is_sensitive: false, is_public: true, sort_order: 3 },
  { key: 'maintenance_admin_bypass', value: 'true', type: 'boolean', group_name: 'maintenance', label: 'Admin Bypass', description: 'Allow admin panel access during maintenance', is_sensitive: false, is_public: false, sort_order: 4 },

  // Notification toggles
  { key: 'push_customer_enabled', value: 'true', type: 'boolean', group_name: 'notifications', label: 'Customer Notifications', description: 'Enable push notifications for customers', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'push_provider_enabled', value: 'true', type: 'boolean', group_name: 'notifications', label: 'Provider Notifications', description: 'Enable push notifications for providers', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'push_booking_enabled', value: 'true', type: 'boolean', group_name: 'notifications', label: 'Booking Notifications', description: 'Enable booking-related push notifications', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'push_promotional_enabled', value: 'false', type: 'boolean', group_name: 'notifications', label: 'Promotional Notifications', description: 'Enable promotional push notifications', is_sensitive: false, is_public: false, sort_order: 4 },
  { key: 'notification_templates', value: '{}', type: 'json', group_name: 'notifications', label: 'Notification Templates', description: 'JSON map of notification template overrides', is_sensitive: false, is_public: false, sort_order: 5 },

  // Finance extensions
  { key: 'cancellation_fee_amount', value: '0', type: 'number', group_name: 'finance', label: 'Cancellation Fee (Fixed)', description: 'Fixed cancellation fee amount', is_sensitive: false, is_public: false, sort_order: 6 },
  { key: 'cancellation_fee_percentage', value: '0', type: 'number', group_name: 'finance', label: 'Cancellation Fee (%)', description: 'Percentage-based cancellation fee', is_sensitive: false, is_public: false, sort_order: 7 },
  { key: 'convenience_fee_amount', value: '0', type: 'number', group_name: 'finance', label: 'Convenience Fee (Fixed)', description: 'Fixed convenience fee amount', is_sensitive: false, is_public: false, sort_order: 8 },
  { key: 'convenience_fee_percentage', value: '0', type: 'number', group_name: 'finance', label: 'Convenience Fee (%)', description: 'Percentage-based convenience fee', is_sensitive: false, is_public: false, sort_order: 9 },
  { key: 'refund_rules', value: 'Full refund if cancelled 24+ hours before service. Partial refund may apply otherwise.', type: 'text', group_name: 'finance', label: 'Refund Rules', description: 'Refund policy text shown to users', is_sensitive: false, is_public: true, sort_order: 10 },

  // Service defaults
  { key: 'car_wash_default_duration_minutes', value: '45', type: 'number', group_name: 'services', label: 'Car Wash Default Duration (min)', description: 'Default service duration for car wash', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'ev_charging_default_duration_minutes', value: '60', type: 'number', group_name: 'services', label: 'EV Charging Default Duration (min)', description: 'Default service duration for EV charging', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'ev_charging_stations', value: '[]', type: 'json', group_name: 'services', label: 'EV Charging Stations', description: 'JSON list of EV charging station locations', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'car_wash_packages', value: '[]', type: 'json', group_name: 'services', label: 'Car Wash Packages', description: 'JSON list of car wash package options and pricing', is_sensitive: false, is_public: false, sort_order: 4 },

  // Invoice extensions
  { key: 'invoice_logo', value: null, type: 'image', group_name: 'invoice', label: 'Invoice Logo', description: 'Logo displayed on invoices', is_sensitive: false, is_public: false, sort_order: 7 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query('SELECT `key` FROM app_settings', {
      type: Sequelize.QueryTypes.SELECT,
    }).catch(() => []);

    const existingKeys = new Set(existing.map((r) => r.key));
    const now = new Date();

    const toInsert = newSettings
      .filter((s) => !existingKeys.has(s.key))
      .map((s) => ({
        ...s,
        value: s.value === null ? null : String(s.value),
        created_at: now,
        updated_at: now,
      }));

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('app_settings', toInsert);
    }

    await queryInterface.createTable('service_areas', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(191),
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      county: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      zip_codes: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'JSON array of zip/postal codes',
      },
      boundary_geojson: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'GeoJSON polygon for map boundaries',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('service_areas', ['is_active']);
    await queryInterface.addIndex('service_areas', ['country', 'state', 'city']);
  },

  async down(queryInterface) {
    const keys = newSettings.map((s) => s.key);
    await queryInterface.bulkDelete('app_settings', { key: keys });
    await queryInterface.dropTable('service_areas');
  },
};
