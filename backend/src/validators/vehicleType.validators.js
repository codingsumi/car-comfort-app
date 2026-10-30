const { body, param, query } = require('express-validator');

const createVehicleTypeValidator = [
  body('name')
    .notEmpty()
    .withMessage('name is required')
    .isString()
    .withMessage('name must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('name must be between 1 and 120 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be active or inactive'),
  body('charges')
    .exists({ checkNull: true })
    .withMessage('charges is required')
    .bail()
    .isFloat({ min: 0 })
    .withMessage('charges must be a non-negative number'),
];

const updateVehicleTypeValidator = [
  body()
    .custom((value, { req }) => {
      const keys = ['name', 'status', 'charges'];
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      if (!keys.some((k) => Object.prototype.hasOwnProperty.call(b, k))) {
        throw new Error('At least one of name, status, charges is required');
      }
      return true;
    })
    .withMessage('At least one of name, status, charges is required'),
  body('name')
    .optional()
    .isString()
    .withMessage('name must be a string')
    .trim()
    .notEmpty()
    .withMessage('name cannot be empty')
    .isLength({ min: 1, max: 120 })
    .withMessage('name must be between 1 and 120 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be active or inactive'),
  body('charges')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('charges must be a non-negative number'),
];

const vehicleTypeIdParamValidator = param('id')
  .isInt({ min: 1 })
  .withMessage('id must be a positive integer');

const listVehicleTypesValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'inactive']),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('sort').optional().isIn(['name', 'status', 'charges', 'created_at', 'updated_at']),
  query('order').optional().isIn(['asc', 'desc']),
  query('all').optional().isIn(['true', 'false']),
];

module.exports = {
  createVehicleTypeValidator,
  updateVehicleTypeValidator,
  vehicleTypeIdParamValidator,
  listVehicleTypesValidator,
};

