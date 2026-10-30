const { body, param, query } = require('express-validator');
const { SERVICE_TYPES } = require('../constants/serviceTypes');

const serviceTypeBody = body('service_type')
  .isIn(SERVICE_TYPES)
  .withMessage('service_type must be car_wash, ev_charging, or combo');

const serviceTypeOptionalBody = body('service_type')
  .optional()
  .isIn(SERVICE_TYPES)
  .withMessage('service_type must be car_wash, ev_charging, or combo');

const packageIdParam = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

const createPackageValidator = [
  body('package_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 }),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 }),
  body()
    .custom((_, { req }) => {
      const name = String(req.body.package_name || req.body.name || '').trim();
      if (!name) throw new Error('package_name is required');
      return true;
    }),
  serviceTypeBody,
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('price must be a non-negative number'),
  body('base_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('base_price must be a non-negative number'),
  body('provider_compensation_type')
    .optional()
    .isIn(['fixed', 'percentage'])
    .withMessage('provider_compensation_type must be fixed or percentage'),
  body('provider_compensation_value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('provider_compensation_value must be a non-negative number'),
  body('on_demand_provider_compensation_value')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('on_demand_provider_compensation_value must be a non-negative number'),
  body('on_demand_provider_compensation_type')
    .optional({ nullable: true })
    .isIn(['fixed', 'percentage'])
    .withMessage('on_demand_provider_compensation_type must be fixed or percentage'),
  body()
    .custom((_, { req }) => {
      const price = req.body.price ?? req.body.base_price;
      if (price === undefined || price === null || price === '') {
        throw new Error('price is required');
      }
      return true;
    }),
  body('is_active').optional().isBoolean(),
  body('duration_minutes').optional().isInt({ min: 1, max: 24 * 60 }),
  body('description').optional().isString().trim().isLength({ max: 5000 }),
];

const updatePackageValidator = [
  ...packageIdParam,
  body('package_name').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 160 }),
  serviceTypeOptionalBody,
  body('price').optional().isFloat({ min: 0 }),
  body('base_price').optional().isFloat({ min: 0 }),
  body('provider_compensation_type')
    .optional()
    .isIn(['fixed', 'percentage'])
    .withMessage('provider_compensation_type must be fixed or percentage'),
  body('provider_compensation_value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('provider_compensation_value must be a non-negative number'),
  body('on_demand_provider_compensation_value')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('on_demand_provider_compensation_value must be a non-negative number'),
  body('on_demand_provider_compensation_type')
    .optional({ nullable: true })
    .isIn(['fixed', 'percentage'])
    .withMessage('on_demand_provider_compensation_type must be fixed or percentage'),
  body('is_active').optional().isBoolean(),
  body('duration_minutes').optional().isInt({ min: 1, max: 24 * 60 }),
  body('description').optional().isString().trim().isLength({ max: 5000 }),
];

const listPackagesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('service_type').optional().isIn(SERVICE_TYPES),
  query('is_active').optional().isIn(['true', 'false']),
  query('search').optional().isString().trim().isLength({ max: 160 }),
  query('sort')
    .optional()
    .isIn(['created_at', 'package_name', 'price', 'is_active', 'service_type']),
  query('order').optional().isIn(['asc', 'desc']),
];

const patchServiceValidator = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  body('icon').optional({ nullable: true }).isString().trim().isLength({ max: 2048 }),
];

module.exports = {
  createPackageValidator,
  updatePackageValidator,
  listPackagesValidator,
  patchServiceValidator,
  packageIdParam,
};
