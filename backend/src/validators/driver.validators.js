const { body, param } = require('express-validator');

const stepNumberValidator = [
  param('stepNumber')
    .trim()
    .notEmpty()
    .withMessage('stepNumber is required')
    .isInt({ min: 1 })
    .withMessage('stepNumber must be a positive integer')
];

const driverVerifyOtpValidator = [
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('otp is required')
    .matches(/^\d{4,6}$/)
    .withMessage('otp must be 4 to 6 digits')
];

const updateDriverProfileValidator = [
  body('first_name').optional({ nullable: true }).isString().isLength({ min: 1, max: 60 }).withMessage('first_name must be 1-60 chars'),
  body('last_name').optional({ nullable: true }).isString().isLength({ min: 0, max: 60 }).withMessage('last_name must be <= 60 chars'),
  body('phone').optional({ nullable: true }).isString().isLength({ min: 6, max: 32 }).withMessage('phone must be 6-32 chars')
];

const driverUpdateServiceLocationValidator = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  body('service_address').trim().notEmpty().withMessage('service_address is required'),
  body('service_latitude').isFloat({ min: -90, max: 90 }).withMessage('service_latitude must be -90..90'),
  body('service_longitude').isFloat({ min: -180, max: 180 }).withMessage('service_longitude must be -180..180'),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('reason must be <= 500 chars')
];

module.exports = {
  stepNumberValidator,
  driverVerifyOtpValidator,
  updateDriverProfileValidator,
  driverUpdateServiceLocationValidator
};

