'use strict';

const adminPanelSettings = [
  {
    key: 'admin_panel_name',
    value: 'Car Comfort',
    type: 'text',
    group_name: 'admin_panel',
    label: 'Admin Panel Name',
    description: 'Display name shown in the admin dashboard',
    is_sensitive: false,
    is_public: true,
    sort_order: 1,
  },
  {
    key: 'admin_panel_logo',
    value: null,
    type: 'image',
    group_name: 'admin_panel',
    label: 'Admin Panel Logo',
    description: 'Logo displayed in the admin sidebar and login page',
    is_sensitive: false,
    is_public: true,
    sort_order: 2,
  },
  {
    key: 'admin_panel_favicon',
    value: null,
    type: 'image',
    group_name: 'admin_panel',
    label: 'Admin Panel Favicon',
    description: 'Browser tab icon for the admin dashboard',
    is_sensitive: false,
    is_public: true,
    sort_order: 3,
  },
  {
    key: 'admin_panel_theme_mode',
    value: 'light',
    type: 'text',
    group_name: 'admin_panel',
    label: 'Theme Mode',
    description: 'Admin theme: light, dark, or system',
    is_sensitive: false,
    is_public: true,
    sort_order: 4,
  },
  {
    key: 'admin_panel_primary_color',
    value: '#E4101F',
    type: 'color',
    group_name: 'admin_panel',
    label: 'Primary Color',
    description: 'Primary accent color for buttons, links, and highlights',
    is_sensitive: false,
    is_public: true,
    sort_order: 5,
  },
  {
    key: 'admin_panel_sidebar_color',
    value: '#FFFFFF',
    type: 'color',
    group_name: 'admin_panel',
    label: 'Sidebar Color',
    description: 'Background color for the admin sidebar',
    is_sensitive: false,
    is_public: true,
    sort_order: 6,
  },
  {
    key: 'admin_panel_header_color',
    value: '#FFFFFF',
    type: 'color',
    group_name: 'admin_panel',
    label: 'Header Color',
    description: 'Background color for the admin top header bar',
    is_sensitive: false,
    is_public: true,
    sort_order: 7,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize
      .query('SELECT `key` FROM app_settings', { type: Sequelize.QueryTypes.SELECT })
      .catch(() => []);

    const existingKeys = new Set(existing.map((r) => r.key));
    const now = new Date();

    const toInsert = adminPanelSettings
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
  },

  async down(queryInterface) {
    const keys = adminPanelSettings.map((s) => s.key);
    await queryInterface.bulkDelete('app_settings', { key: keys });
  },
};
