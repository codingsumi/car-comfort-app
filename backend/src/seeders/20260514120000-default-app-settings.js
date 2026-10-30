'use strict';

const defaultSettings = [
  // General Settings
  { key: 'app_name', value: 'Car Comfort', type: 'text', group_name: 'general', label: 'App Name', description: 'The name of your application', is_sensitive: false, is_public: true, sort_order: 1 },
  { key: 'app_logo', value: null, type: 'image', group_name: 'general', label: 'App Logo', description: 'Main logo of the application', is_sensitive: false, is_public: true, sort_order: 2 },
  { key: 'app_favicon', value: null, type: 'image', group_name: 'general', label: 'Favicon', description: 'Browser tab icon', is_sensitive: false, is_public: true, sort_order: 3 },
  { key: 'support_email', value: 'info@carcomfort-llc.com', type: 'email', group_name: 'general', label: 'Support Email', description: 'Primary support email address', is_sensitive: false, is_public: true, sort_order: 4 },
  { key: 'contact_number', value: '1-800-702-3590', type: 'text', group_name: 'general', label: 'Contact Number', description: 'Primary contact phone number', is_sensitive: false, is_public: true, sort_order: 5 },
  { key: 'address', value: '', type: 'text', group_name: 'general', label: 'Address', description: 'Business address', is_sensitive: false, is_public: true, sort_order: 6 },
  { key: 'default_language', value: 'en', type: 'text', group_name: 'general', label: 'Default Language', description: 'Default language for the platform', is_sensitive: false, is_public: true, sort_order: 7 },
  { key: 'default_currency', value: 'USD', type: 'text', group_name: 'general', label: 'Default Currency', description: 'Default currency code (e.g., USD, EUR)', is_sensitive: false, is_public: true, sort_order: 8 },
  { key: 'timezone', value: 'America/New_York', type: 'text', group_name: 'general', label: 'Timezone', description: 'Default timezone for the platform', is_sensitive: false, is_public: true, sort_order: 9 },

  // Stripe Settings
  { key: 'stripe_publishable_key', value: '', type: 'text', group_name: 'stripe', label: 'Publishable Key', description: 'Stripe publishable (public) key', is_sensitive: false, is_public: true, sort_order: 1 },
  { key: 'stripe_secret_key', value: '', type: 'password', group_name: 'stripe', label: 'Secret Key', description: 'Stripe secret key (encrypted)', is_sensitive: true, is_public: false, sort_order: 2 },
  { key: 'stripe_webhook_secret', value: '', type: 'password', group_name: 'stripe', label: 'Webhook Secret', description: 'Stripe webhook endpoint secret', is_sensitive: true, is_public: false, sort_order: 3 },
  { key: 'stripe_connected_account_enabled', value: 'false', type: 'boolean', group_name: 'stripe', label: 'Connected Accounts', description: 'Enable Stripe Connect for drivers', is_sensitive: false, is_public: false, sort_order: 4 },
  { key: 'stripe_payment_mode', value: 'test', type: 'text', group_name: 'stripe', label: 'Payment Mode', description: 'Stripe mode: test or live', is_sensitive: false, is_public: true, sort_order: 5 },

  // OneSignal Settings
  { key: 'onesignal_app_id', value: '', type: 'text', group_name: 'onesignal', label: 'App ID', description: 'OneSignal application ID', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'onesignal_rest_api_key', value: '', type: 'password', group_name: 'onesignal', label: 'REST API Key', description: 'OneSignal REST API key (encrypted)', is_sensitive: true, is_public: false, sort_order: 2 },
  { key: 'onesignal_user_auth_key', value: '', type: 'password', group_name: 'onesignal', label: 'User Auth Key', description: 'OneSignal user authentication key (encrypted)', is_sensitive: true, is_public: false, sort_order: 3 },

  // Email / SMTP Settings
  { key: 'smtp_host', value: '', type: 'text', group_name: 'email', label: 'SMTP Host', description: 'Email server hostname', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'smtp_port', value: '587', type: 'number', group_name: 'email', label: 'SMTP Port', description: 'Email server port', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'smtp_username', value: '', type: 'text', group_name: 'email', label: 'SMTP Username', description: 'Email server username', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'smtp_password', value: '', type: 'password', group_name: 'email', label: 'SMTP Password', description: 'Email server password (encrypted)', is_sensitive: true, is_public: false, sort_order: 4 },
  { key: 'smtp_encryption', value: 'tls', type: 'text', group_name: 'email', label: 'Encryption Type', description: 'Encryption: none, tls, or ssl', is_sensitive: false, is_public: false, sort_order: 5 },
  { key: 'smtp_from_email', value: '', type: 'email', group_name: 'email', label: 'From Email', description: 'Default sender email address', is_sensitive: false, is_public: false, sort_order: 6 },
  { key: 'smtp_from_name', value: 'Car Comfort', type: 'text', group_name: 'email', label: 'From Name', description: 'Default sender display name', is_sensitive: false, is_public: false, sort_order: 7 },

  // Social Links
  { key: 'social_facebook', value: '', type: 'url', group_name: 'social_links', label: 'Facebook', description: 'Facebook page URL', is_sensitive: false, is_public: true, sort_order: 1 },
  { key: 'social_instagram', value: '', type: 'url', group_name: 'social_links', label: 'Instagram', description: 'Instagram profile URL', is_sensitive: false, is_public: true, sort_order: 2 },
  { key: 'social_youtube', value: '', type: 'url', group_name: 'social_links', label: 'YouTube', description: 'YouTube channel URL', is_sensitive: false, is_public: true, sort_order: 3 },
  { key: 'social_linkedin', value: '', type: 'url', group_name: 'social_links', label: 'LinkedIn', description: 'LinkedIn page URL', is_sensitive: false, is_public: true, sort_order: 4 },
  { key: 'social_twitter', value: '', type: 'url', group_name: 'social_links', label: 'X / Twitter', description: 'X (Twitter) profile URL', is_sensitive: false, is_public: true, sort_order: 5 },

  // Finance Settings
  { key: 'service_fee_percentage', value: '10', type: 'number', group_name: 'finance', label: 'Service Fee %', description: 'Service fee percentage charged to customers on bookings', is_sensitive: false, is_public: false, sort_order: 1 },
  {
    key: 'referral_base_discount_percentage',
    value: '10',
    type: 'number',
    group_name: 'finance',
    label: 'Referral Discount %',
    description: 'Discount percentage applied to base price for referral rewards (referrer and referred friend first booking)',
    is_sensitive: false,
    is_public: false,
    sort_order: 4
  },
  { key: 'platform_fee_percentage', value: '5', type: 'number', group_name: 'finance', label: 'Platform Fee %', description: 'Platform fee percentage charged to customers', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'default_tax_percentage', value: '8', type: 'number', group_name: 'finance', label: 'Default Tax %', description: 'Default tax percentage applied to bookings', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'default_commission_percentage', value: '15', type: 'number', group_name: 'finance', label: 'Default Commission %', description: 'Platform commission percentage from service providers', is_sensitive: false, is_public: false, sort_order: 4 },
  { key: 'currency_symbol', value: '$', type: 'text', group_name: 'finance', label: 'Currency Symbol', description: 'Display currency symbol', is_sensitive: false, is_public: true, sort_order: 5 },

  // Provider Performance Thresholds
  { key: 'provider_min_rating_threshold', value: '3.0', type: 'number', group_name: 'provider_performance', label: 'Min Rating Threshold', description: 'Providers below this average rating get flagged', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'provider_max_cancellation_rate', value: '20', type: 'number', group_name: 'provider_performance', label: 'Max Cancellation Rate %', description: 'Providers exceeding this cancellation rate get flagged', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'provider_max_complaint_count', value: '5', type: 'number', group_name: 'provider_performance', label: 'Max Complaint Count', description: 'Providers with this many or more complaints get flagged', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'provider_max_open_disputes', value: '3', type: 'number', group_name: 'provider_performance', label: 'Max Open Disputes', description: 'Providers with this many open disputes get flagged', is_sensitive: false, is_public: false, sort_order: 4 },
  { key: 'provider_default_daily_limit', value: '4', type: 'number', group_name: 'provider_performance', label: 'Default Daily Service Limit', description: 'Default maximum services a provider can complete per day', is_sensitive: false, is_public: false, sort_order: 5 },
  { key: 'provider_vacuum_penalty_default', value: '25', type: 'number', group_name: 'provider_performance', label: 'Default Vacuum Penalty ($)', description: 'Default vacuum penalty amount in dollars', is_sensitive: false, is_public: false, sort_order: 6 },

  // Theme / UI Settings
  { key: 'theme_primary_color', value: '#2563EB', type: 'color', group_name: 'theme', label: 'Primary Color', description: 'Main brand color', is_sensitive: false, is_public: true, sort_order: 1 },
  { key: 'theme_secondary_color', value: '#1E293B', type: 'color', group_name: 'theme', label: 'Secondary Color', description: 'Secondary brand color', is_sensitive: false, is_public: true, sort_order: 2 },
  { key: 'theme_sidebar_style', value: 'light', type: 'text', group_name: 'theme', label: 'Sidebar Style', description: 'Sidebar appearance: light, dark, or brand', is_sensitive: false, is_public: true, sort_order: 3 },
  { key: 'theme_dark_mode_enabled', value: 'false', type: 'boolean', group_name: 'theme', label: 'Dark Mode', description: 'Enable dark mode by default', is_sensitive: false, is_public: true, sort_order: 4 },
  { key: 'theme_logo_light', value: null, type: 'image', group_name: 'theme', label: 'Logo (Light)', description: 'Logo for light backgrounds', is_sensitive: false, is_public: true, sort_order: 5 },
  { key: 'theme_logo_dark', value: null, type: 'image', group_name: 'theme', label: 'Logo (Dark)', description: 'Logo for dark backgrounds', is_sensitive: false, is_public: true, sort_order: 6 },

  // Invoice Company Details
  { key: 'invoice_company_name', value: 'Car Comfort LLC', type: 'text', group_name: 'invoice', label: 'Company Name', description: 'Legal company name on invoices', is_sensitive: false, is_public: false, sort_order: 1 },
  { key: 'invoice_gst_vat_number', value: '', type: 'text', group_name: 'invoice', label: 'Tax ID / GST/VAT Number', description: 'Tax registration number shown on customer receipts', is_sensitive: false, is_public: false, sort_order: 2 },
  { key: 'invoice_website', value: '', type: 'url', group_name: 'invoice', label: 'Company Website', description: 'Website shown on customer receipts', is_sensitive: false, is_public: false, sort_order: 3 },
  { key: 'invoice_email', value: '', type: 'email', group_name: 'invoice', label: 'Invoice Email', description: 'Email shown on invoices', is_sensitive: false, is_public: false, sort_order: 4 },
  { key: 'invoice_phone', value: '', type: 'text', group_name: 'invoice', label: 'Invoice Phone', description: 'Phone shown on invoices', is_sensitive: false, is_public: false, sort_order: 5 },
  { key: 'invoice_address', value: '166 Geary Street\nSan Francisco, California 94108', type: 'text', group_name: 'invoice', label: 'Invoice Address', description: 'Address shown on invoices', is_sensitive: false, is_public: false, sort_order: 6 },
  { key: 'invoice_footer_notes', value: 'This receipt was generated electronically and is valid without a signature. Prices are in USD. For questions, please contact Car Comfort support.', type: 'text', group_name: 'invoice', label: 'Footer Notes', description: 'Notes shown at the bottom of invoices', is_sensitive: false, is_public: false, sort_order: 7 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      'SELECT `key` FROM app_settings',
      { type: Sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    const existingKeys = new Set(existing.map((r) => r.key));
    const now = new Date();

    const toInsert = defaultSettings
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
    const keys = defaultSettings.map((s) => s.key);
    await queryInterface.bulkDelete('app_settings', { key: keys });
  },
};
