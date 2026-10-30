const { body, param, query } = require('express-validator');

const CHANNELS = ['push', 'email', 'in_app', 'sms'];
const SEGMENTS = [
  'all_customers',
  'all_providers',
  'specific_users',
  'custom',
];
const TEMPLATE_TYPES = [
  'booking',
  'promotional',
  'payment',
  'refund',
  'provider',
  'support',
];
const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];

const sendNotificationRules = [
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('message').trim().notEmpty(),
  body('channels').isArray({ min: 1 }),
  body('channels.*').isIn(CHANNELS.filter((c) => c !== 'sms')),
  body('segment').optional().isIn(SEGMENTS),
  body('audience_filters').optional().isObject(),
  body('scheduled_at').optional().isISO8601(),
  body('timezone').optional().isString(),
  body('image_url').optional({ values: 'falsy' }).isURL().isLength({ max: 512 }),
  body('deep_link_url').optional().isString().isLength({ max: 512 }),
  body('cta_text').optional().isString().isLength({ max: 64 }),
  body('cta_url').optional().isString().isLength({ max: 512 }),
];

const campaignRules = [
  body('campaign_name').trim().notEmpty().isLength({ max: 160 }),
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('message').trim().notEmpty(),
  body('channels').optional().isArray(),
  body('channels.*').optional().isIn(CHANNELS.filter((c) => c !== 'sms')),
  body('audience_filters').optional().isObject(),
  body('status').optional().isIn(CAMPAIGN_STATUSES),
  body('scheduled_at').optional().isISO8601(),
];

const templateRules = [
  body('template_name').trim().notEmpty().isLength({ max: 120 }),
  body('template_type').isIn(TEMPLATE_TYPES),
  body('title_template').trim().notEmpty().isLength({ max: 255 }),
  body('body_template').trim().notEmpty(),
  body('variables').optional().isArray(),
  body('is_active').optional().isBoolean(),
];

module.exports = {
  sendNotificationRules,
  campaignRules,
  templateRules,
  listLogsRules: [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('channel').optional().isIn(CHANNELS),
    query('delivery_status').optional().isString(),
    query('campaign_id').optional().isInt({ min: 1 }),
    query('from_date').optional().isISO8601(),
    query('to_date').optional().isISO8601(),
  ],
  idParamRules: [param('id').isInt({ min: 1 })],
};
