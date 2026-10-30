const { body, param } = require('express-validator');

const bookingChargeIdParam = param('id').isInt({ min: 1 }).withMessage('id must be a positive integer');

const codeValidator = body('code')
  .isString()
  .trim()
  .notEmpty()
  .withMessage('code is required')
  .matches(/^[a-z0-9_]+$/)
  .withMessage('code may only contain lowercase letters, numbers, and underscores')
  .isLength({ max: 64 })
  .withMessage('code must be 64 characters or fewer');

const labelValidator = body('label')
  .isString()
  .trim()
  .isLength({ min: 1, max: 160 })
  .withMessage('label must be 1-160 characters');

const amountValidator = body('amount')
  .isFloat({ min: 0 })
  .withMessage('amount must be a non-negative number');

const isActiveValidator = body('is_active').optional().isBoolean();

const sortOrderValidator = body('sort_order')
  .optional()
  .isInt({ min: 0 })
  .withMessage('sort_order must be a non-negative integer');

const serviceApplicabilityValidator = body('service_applicability')
  .optional()
  .isString()
  .trim()
  .isIn(['all', 'car_wash', 'ev_charging', 'both', 'car', 'ev'])
  .withMessage('service_applicability must be all, car_wash, or ev_charging');

const createBookingChargeValidator = [
  codeValidator,
  labelValidator,
  amountValidator,
  isActiveValidator,
  sortOrderValidator,
  serviceApplicabilityValidator,
];

const updateBookingChargeValidator = [
  bookingChargeIdParam,
  body('label').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('amount must be a non-negative number'),
  isActiveValidator,
  serviceApplicabilityValidator,
  body()
    .custom((_, { req }) => {
      const keys = ['label', 'amount', 'is_active', 'service_applicability'];
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      if (!keys.some((k) => Object.prototype.hasOwnProperty.call(b, k))) {
        throw new Error('At least one of label, amount, is_active, service_applicability is required');
      }
      return true;
    })
    .withMessage('At least one of label, amount, is_active, service_applicability is required'),
];

const deleteBookingChargeValidator = [bookingChargeIdParam];

module.exports = {
  createBookingChargeValidator,
  updateBookingChargeValidator,
  deleteBookingChargeValidator,
};
