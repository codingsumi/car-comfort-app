const { body, param, query } = require('express-validator');

const VALID_GROUPS = [
  'general',
  'stripe',
  'onesignal',
  'email',
  'social_links',
  'finance',
  'theme',
  'invoice',
  'admin_panel',
  'maintenance',
  'notifications',
  'services',
  'provider_performance',
];

const validateGroupParam = [
  param('group')
    .isIn(VALID_GROUPS)
    .withMessage(`Group must be one of: ${VALID_GROUPS.join(', ')}`),
];

const validateGeneralSettings = [
  body('app_name').optional().isString().isLength({ max: 255 }).withMessage('App name must be a string (max 255 chars)'),
  body('app_description').optional().isString().isLength({ max: 500 }).withMessage('App description max 500 chars'),
  body('support_email').optional().isEmail().withMessage('Must be a valid email'),
  body('contact_number').optional().isString().isLength({ max: 20 }).withMessage('Contact number max 20 chars'),
  body('address').optional().isString().isLength({ max: 500 }).withMessage('Address max 500 chars'),
  body('default_language').optional().isString().isLength({ max: 10 }).withMessage('Language code max 10 chars'),
  body('default_currency').optional().isString().isLength({ max: 10 }).withMessage('Currency code max 10 chars'),
  body('timezone').optional().isString().isLength({ max: 50 }).withMessage('Timezone max 50 chars'),
  body('date_format').optional().isString().isLength({ max: 30 }).withMessage('Date format max 30 chars'),
  body('time_format').optional().isIn(['12h', '24h']).withMessage('Time format must be 12h or 24h'),
];

const validateStripeSettings = [
  body('stripe_publishable_key').optional().isString().isLength({ max: 500 }).withMessage('Publishable key max 500 chars'),
  body('stripe_secret_key').optional().isString().isLength({ max: 500 }).withMessage('Secret key max 500 chars'),
  body('stripe_webhook_secret').optional().isString().isLength({ max: 500 }).withMessage('Webhook secret max 500 chars'),
  body('stripe_connected_account_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
  body('stripe_payment_mode').optional().isIn(['test', 'live']).withMessage('Payment mode must be test or live'),
];

const validateOnesignalSettings = [
  body('onesignal_app_id').optional().isString().isLength({ max: 255 }).withMessage('App ID max 255 chars'),
  body('onesignal_rest_api_key').optional().isString().isLength({ max: 500 }).withMessage('REST API key max 500 chars'),
  body('onesignal_user_auth_key').optional().isString().isLength({ max: 500 }).withMessage('User auth key max 500 chars'),
];

const validateEmailSettings = [
  body('smtp_host').optional().isString().isLength({ max: 255 }).withMessage('SMTP host max 255 chars'),
  body('smtp_port').optional().isInt({ min: 1, max: 65535 }).withMessage('SMTP port must be 1-65535'),
  body('smtp_username').optional().isString().isLength({ max: 255 }).withMessage('SMTP username max 255 chars'),
  body('smtp_password').optional().isString().isLength({ max: 500 }).withMessage('SMTP password max 500 chars'),
  body('smtp_encryption').optional().isIn(['none', 'tls', 'ssl']).withMessage('Encryption must be none, tls, or ssl'),
  body('smtp_from_email').optional().isEmail().withMessage('From email must be valid'),
  body('smtp_from_name').optional().isString().isLength({ max: 255 }).withMessage('From name max 255 chars'),
];

const validateSocialLinksSettings = [
  body('social_facebook').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
  body('social_instagram').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
  body('social_youtube').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
  body('social_linkedin').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
  body('social_twitter').optional({ values: 'falsy' }).isURL().withMessage('Must be a valid URL'),
];

const validateFinanceSettings = [
  body('service_fee_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Service fee must be 0-100'),
  body('referral_base_discount_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Referral discount must be 0-100'),
  body('referral_service_fee_discount_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Referral discount must be 0-100'),
  body('platform_fee_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Platform fee must be 0-100'),
  body('default_tax_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax must be 0-100'),
  body('default_commission_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Commission must be 0-100'),
  body('cancellation_fee_amount').optional().isFloat({ min: 0 }).withMessage('Cancellation fee amount must be >= 0'),
  body('cancellation_fee_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Cancellation fee % must be 0-100'),
  body('convenience_fee_amount').optional().isFloat({ min: 0 }).withMessage('Convenience fee amount must be >= 0'),
  body('convenience_fee_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Convenience fee % must be 0-100'),
  body('currency_symbol').optional().isString().isLength({ max: 10 }).withMessage('Currency symbol max 10 chars'),
  body('refund_rules').optional().isString().isLength({ max: 2000 }).withMessage('Refund rules max 2000 chars'),
];

const validateThemeSettings = [
  body('theme_primary_color').optional().matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Must be a valid hex color'),
  body('theme_secondary_color').optional().matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Must be a valid hex color'),
  body('theme_sidebar_style').optional().isIn(['light', 'dark', 'brand']).withMessage('Sidebar style must be light, dark, or brand'),
  body('theme_dark_mode_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
];

const validateInvoiceSettings = [
  body('invoice_company_name').optional().isString().isLength({ max: 255 }).withMessage('Company name max 255 chars'),
  body('invoice_gst_vat_number').optional().isString().isLength({ max: 50 }).withMessage('GST/VAT max 50 chars'),
  body('invoice_website').optional({ checkFalsy: true }).isURL({ require_protocol: false }).withMessage('Must be a valid website URL'),
  body('invoice_email').optional().isEmail().withMessage('Must be a valid email'),
  body('invoice_phone').optional().isString().isLength({ max: 20 }).withMessage('Phone max 20 chars'),
  body('invoice_address').optional().isString().isLength({ max: 500 }).withMessage('Address max 500 chars'),
  body('invoice_footer_notes').optional().isString().isLength({ max: 1000 }).withMessage('Footer notes max 1000 chars'),
];

const ADMIN_PANEL_PRIMARY_COLORS = ['#E4101F', '#FF7A00', '#FFA92C', '#00A416'];

const validateAdminPanelSettings = [
  body('admin_panel_name').optional().isString().isLength({ max: 255 }).withMessage('Admin panel name max 255 chars'),
  body('admin_panel_primary_color')
    .optional()
    .isIn(ADMIN_PANEL_PRIMARY_COLORS)
    .withMessage(`Primary color must be one of: ${ADMIN_PANEL_PRIMARY_COLORS.join(', ')}`),
];

const validateAuditLogsQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('group').optional().isIn(VALID_GROUPS).withMessage(`Group must be one of: ${VALID_GROUPS.join(', ')}`),
];

const validateMaintenanceSettings = [
  body('maintenance_mode_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
  body('maintenance_message').optional().isString().isLength({ max: 1000 }).withMessage('Message max 1000 chars'),
  body('maintenance_expected_return').optional().isString().isLength({ max: 100 }).withMessage('Expected return max 100 chars'),
  body('maintenance_admin_bypass').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
];

const validateNotificationSettings = [
  body('push_customer_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
  body('push_provider_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
  body('push_booking_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
  body('push_promotional_enabled').optional().isIn(['true', 'false', true, false]).withMessage('Must be boolean'),
];

const validateServicesSettings = [
  body('car_wash_default_duration_minutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be 1-480'),
  body('ev_charging_default_duration_minutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be 1-480'),
];

const validateProviderPerformanceSettings = [
  body('provider_min_rating_threshold').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
  body('provider_max_cancellation_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Rate must be 0-100'),
  body('provider_max_complaint_count').optional().isInt({ min: 0 }).withMessage('Must be >= 0'),
  body('provider_max_open_disputes').optional().isInt({ min: 0 }).withMessage('Must be >= 0'),
  body('provider_default_daily_limit').optional().isInt({ min: 1 }).withMessage('Must be >= 1'),
  body('provider_vacuum_penalty_default').optional().isFloat({ min: 0 }).withMessage('Must be >= 0'),
];

const validateServiceAreaBody = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('country').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  body('state').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  body('county').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  body('city').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  body('zip_codes').optional().isArray().withMessage('zip_codes must be an array'),
  body('boundary_geojson').optional(),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
];

const validateServiceAreaId = [param('id').isInt({ min: 1 }).withMessage('Invalid service area ID')];

const validateTestEmailBody = [
  body('to').optional().isEmail().withMessage('Must be a valid email address'),
];

const groupValidators = {
  general: validateGeneralSettings,
  stripe: validateStripeSettings,
  onesignal: validateOnesignalSettings,
  email: validateEmailSettings,
  social_links: validateSocialLinksSettings,
  finance: validateFinanceSettings,
  theme: validateThemeSettings,
  invoice: validateInvoiceSettings,
  admin_panel: validateAdminPanelSettings,
  maintenance: validateMaintenanceSettings,
  notifications: validateNotificationSettings,
  services: validateServicesSettings,
  provider_performance: validateProviderPerformanceSettings,
};

module.exports = {
  validateGroupParam,
  validateAuditLogsQuery,
  validateServiceAreaBody,
  validateServiceAreaId,
  validateTestEmailBody,
  groupValidators,
  VALID_GROUPS,
};
