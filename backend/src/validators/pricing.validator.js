const { body, param } = require('express-validator');

const pricingRuleValidator = [
  body('service_type')
    .isIn(['car_wash', 'ev_charging', 'combo', 'add_on', 'convenience_fee', 'cancellation_fee'])
    .withMessage('Valid service type is required'),
  body('location_type')
    .optional()
    .isIn(['default', 'country', 'state', 'county', 'city'])
    .withMessage('Invalid location type'),
  body('country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  body('state')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  body('county')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  body('city')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  body('base_price')
    .isFloat({ min: 0 })
    .withMessage('Base price must be a non-negative number'),
  body('surge_multiplier')
    .optional()
    .isFloat({ min: 0.01, max: 10 })
    .withMessage('Surge multiplier must be between 0.01 and 10'),
  body('surge_enabled')
    .optional()
    .isBoolean(),
  body('tax_percentage')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Tax percentage must be between 0 and 50'),
  body('commission_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),
  body('provider_earning_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Provider earning percentage must be between 0 and 100'),
  body('effective_from')
    .isISO8601()
    .withMessage('Valid effective_from date is required'),
  body('effective_to')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('effective_to must be a valid date'),
];

const pricingUpdateValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid pricing rule ID is required'),
  body('base_price')
    .optional()
    .isFloat({ min: 0 }),
  body('surge_multiplier')
    .optional()
    .isFloat({ min: 0.01, max: 10 }),
  body('tax_percentage')
    .optional()
    .isFloat({ min: 0, max: 50 }),
  body('commission_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 }),
  body('provider_earning_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 }),
];

const pricingIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid pricing rule ID is required'),
];

module.exports = {
  pricingRuleValidator,
  pricingUpdateValidator,
  pricingIdValidator,
};
