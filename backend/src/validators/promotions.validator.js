'use strict';

const { body, param } = require('express-validator');

const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];
const DISCOUNT_TYPES = ['percentage', 'flat'];
const AUDIENCE_TYPES = ['all', 'new_customers'];
const RECURRENCE_TYPES = ['one_time', 'weekly', 'monthly'];
const STATUSES = ['active', 'inactive', 'scheduled'];

const promotionCreateValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional({ nullable: true }).isString(),
  body('discount_type').isIn(DISCOUNT_TYPES).withMessage('Invalid discount type'),
  body('discount_value')
    .isFloat({ min: 0.01 })
    .withMessage('Discount value must be a positive number'),
  body('applicable_services')
    .optional({ nullable: true })
    .isArray()
    .withMessage('applicable_services must be an array'),
  body('applicable_services.*')
    .optional()
    .isIn(SERVICE_TYPES)
    .withMessage('Invalid service type'),
  body('audience').isIn(AUDIENCE_TYPES).withMessage('Invalid audience'),
  body('recurrence').isIn(RECURRENCE_TYPES).withMessage('Invalid recurrence'),
  body('start_date').optional({ nullable: true }).isDate().withMessage('Invalid start date'),
  body('end_date').optional({ nullable: true }).isDate().withMessage('Invalid end date'),
  body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  body('max_uses').optional({ nullable: true }).isInt({ min: 1 }).withMessage('max_uses must be a positive integer'),
];

const promotionUpdateValidator = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional({ nullable: true }).isString(),
  body('discount_type').optional().isIn(DISCOUNT_TYPES),
  body('discount_value').optional().isFloat({ min: 0.01 }),
  body('applicable_services').optional({ nullable: true }).isArray(),
  body('applicable_services.*').optional().isIn(SERVICE_TYPES),
  body('audience').optional().isIn(AUDIENCE_TYPES),
  body('recurrence').optional().isIn(RECURRENCE_TYPES),
  body('start_date').optional({ nullable: true }).isDate(),
  body('end_date').optional({ nullable: true }).isDate(),
  body('status').optional().isIn([...STATUSES, 'expired']),
  body('max_uses').optional({ nullable: true }).isInt({ min: 1 }),
];

const promotionIdValidator = [param('id').isInt({ min: 1 })];

module.exports = {
  promotionCreateValidator,
  promotionUpdateValidator,
  promotionIdValidator,
};
