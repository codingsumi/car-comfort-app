const { body, param } = require('express-validator');
const { FUEL_TYPE_OPTIONS, fuelTypeValidationMessage } = require('../constants/vehicleFuelTypes');

const currentYear = new Date().getFullYear();

// A license plate may only contain letters, digits, spaces and hyphens, and
// must begin with an alphanumeric character. This blocks junk/injection input
// such as `&@@@@@@` while remaining permissive across regions.
const LICENSE_PLATE_REGEX = /^[A-Z0-9][A-Z0-9 -]{0,31}$/;
const LICENSE_PLATE_MESSAGE =
  'license_plate must contain only letters, numbers, spaces or hyphens';

const normalizeLicensePlate = (value) =>
  value == null ? value : String(value).trim().toUpperCase().replace(/\s+/g, ' ');

const createVehicleValidator = [
  body('vehicle_type')
    .notEmpty()
    .withMessage('vehicle_type is required')
    .isString()
    .withMessage('vehicle_type must be a string')
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('vehicle_type must be between 1 and 64 characters'),
  body('make')
    .notEmpty()
    .withMessage('make is required')
    .isString()
    .withMessage('make must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('make must be between 1 and 120 characters'),
  body('model')
    .notEmpty()
    .withMessage('model is required')
    .isString()
    .withMessage('model must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('model must be between 1 and 120 characters'),
  body('color')
    .notEmpty()
    .withMessage('color is required')
    .isString()
    .withMessage('color must be a string')
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('color must be between 1 and 64 characters'),
  body('license_plate')
    .notEmpty()
    .withMessage('license_plate is required')
    .isString()
    .withMessage('license_plate must be a string')
    .trim()
    .customSanitizer(normalizeLicensePlate)
    .isLength({ min: 2, max: 32 })
    .withMessage('license_plate must be between 2 and 32 characters')
    .matches(LICENSE_PLATE_REGEX)
    .withMessage(LICENSE_PLATE_MESSAGE),
  body('year')
    .notEmpty()
    .withMessage('year is required')
    .isInt({ min: 1900, max: currentYear + 1 })
    .withMessage(`year must be an integer from 1900 to ${currentYear + 1}`),
  body('nickname')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('nickname must be a string')
    .trim()
    .isLength({ max: 120 })
    .withMessage('nickname must be at most 120 characters'),
  body('fuel_type')
    .optional()
    .isString()
    .withMessage('fuel_type must be a string')
    .trim()
    .customSanitizer((v) => (v == null ? v : String(v).trim().toUpperCase()))
    .isIn(FUEL_TYPE_OPTIONS)
    .withMessage(fuelTypeValidationMessage()),
  body('battery_capacity_kwh')
    .optional({ nullable: true, checkFalsy: true })
    .custom((v) => {
      if (v === null || v === undefined || String(v).trim() === '') return true;
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) throw new Error('battery_capacity_kwh must be a non-negative number');
      return true;
    }),
];

const updateVehicleValidator = [
  body()
    .custom((value, { req }) => {
      const keys = ['vehicle_type', 'make', 'model', 'year', 'color', 'license_plate', 'nickname', 'fuel_type', 'battery_capacity_kwh'];
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const files = req.files || {};
      const images = Array.isArray(files.images) ? files.images : Array.isArray(files['images[]']) ? files['images[]'] : [];

      if (!keys.some((k) => Object.prototype.hasOwnProperty.call(b, k)) && images.length === 0) {
        throw new Error('At least one of vehicle_type, make, model, year, color, license_plate, nickname, fuel_type, battery_capacity_kwh is required');
      }
      return true;
    })
    .withMessage('At least one of vehicle_type, make, model, year, color, license_plate, nickname, fuel_type, battery_capacity_kwh is required'),
  body('vehicle_type')
    .optional()
    .isString()
    .withMessage('vehicle_type must be a string')
    .trim()
    .notEmpty()
    .withMessage('vehicle_type cannot be empty')
    .isLength({ min: 1, max: 64 })
    .withMessage('vehicle_type must be between 1 and 64 characters'),
  body('make')
    .optional()
    .isString()
    .withMessage('make must be a string')
    .trim()
    .notEmpty()
    .withMessage('make cannot be empty')
    .isLength({ min: 1, max: 120 })
    .withMessage('make must be between 1 and 120 characters'),
  body('model')
    .optional()
    .isString()
    .withMessage('model must be a string')
    .trim()
    .notEmpty()
    .withMessage('model cannot be empty')
    .isLength({ min: 1, max: 120 })
    .withMessage('model must be between 1 and 120 characters'),
  body('color')
    .optional()
    .isString()
    .withMessage('color must be a string')
    .trim()
    .notEmpty()
    .withMessage('color cannot be empty')
    .isLength({ min: 1, max: 64 })
    .withMessage('color must be between 1 and 64 characters'),
  body('license_plate')
    .optional()
    .isString()
    .withMessage('license_plate must be a string')
    .trim()
    .notEmpty()
    .withMessage('license_plate cannot be empty')
    .customSanitizer(normalizeLicensePlate)
    .isLength({ min: 2, max: 32 })
    .withMessage('license_plate must be between 2 and 32 characters')
    .matches(LICENSE_PLATE_REGEX)
    .withMessage(LICENSE_PLATE_MESSAGE),
  body('year')
    .optional()
    .isInt({ min: 1900, max: currentYear + 1 })
    .withMessage(`year must be an integer from 1900 to ${currentYear + 1}`),
  body('nickname')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null) return true;
      if (typeof v !== 'string') throw new Error('nickname must be a string or null');
      if (v.trim().length > 120) throw new Error('nickname must be at most 120 characters');
      return true;
    }),
  body('fuel_type')
    .optional()
    .isString()
    .withMessage('fuel_type must be a string')
    .trim()
    .customSanitizer((v) => (v == null ? v : String(v).trim().toUpperCase()))
    .isIn(FUEL_TYPE_OPTIONS)
    .withMessage(fuelTypeValidationMessage()),
  body('battery_capacity_kwh')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === null || v === '' || v === undefined) return true;
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) throw new Error('battery_capacity_kwh must be a non-negative number or null');
      return true;
    }),
];

const vehicleIdParamValidator = param('id')
  .isInt({ min: 1 })
  .withMessage('id must be a positive integer');

module.exports = {
  createVehicleValidator,
  updateVehicleValidator,
  vehicleIdParamValidator
};
