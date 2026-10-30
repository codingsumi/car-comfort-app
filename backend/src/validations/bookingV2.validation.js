const { body, param } = require('express-validator');
const {
  EV_CHARGER_TYPE_VALUES,
  EV_BATTERY_STATUS_VALUES,
  EV_VEHICLE_CHARGE_LIMIT_SET,
  isValidEvChargerType,
  isValidEvVehicleChargeLimitPercent,
  resolveEvBatteryStatusFromInput,
} = require('../constants/evChargingBooking');

const SERVICE_TYPES = ['car_wash', 'ev_charging', 'combo'];
const CUSTOMER_SCHEDULE_TYPES = ['asap', 'scheduled', 'on_demand'];

const evAccountCardOnFileValidation = body('ev_account_card_on_file')
  .optional({ nullable: true })
  .custom((value) => {
    if (typeof value === 'boolean') return true;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') return true;
    throw new Error('ev_account_card_on_file must be true or false');
  });

const startBookingValidation = [
  body('service_type').isIn(SERVICE_TYPES).withMessage('service_type is required'),
  evAccountCardOnFileValidation,
  body('charger_type')
    .optional({ nullable: true })
    .custom((v, { req }) => {
      if (v === undefined || v === null || v === '') return true;
      if (!isValidEvChargerType(v)) {
        throw new Error(`charger_type must be one of: ${[...EV_CHARGER_TYPE_VALUES].join(', ')}`);
      }
      const serviceType = String(req.body?.service_type || '').trim();
      if (serviceType && serviceType !== 'ev_charging') {
        throw new Error('charger_type is only allowed for ev_charging');
      }
      return true;
    }),
  body('address').optional({ nullable: true }).isString().withMessage('address must be a string'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude is invalid'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude is invalid'),
  body('service_address').optional({ nullable: true }).isString().withMessage('service_address must be a string'),
  body('service_latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('service_latitude is invalid'),
  body('service_longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('service_longitude is invalid'),
  body('service_location_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('service_location_name must be at most 255 chars'),
  body().custom((v) => {
    const address = v.address === null ? null : String(v.address || '').trim() || null;
    const latOk = v.latitude !== undefined && v.latitude !== null && v.latitude !== '' && Number.isFinite(Number(v.latitude));
    const lngOk = v.longitude !== undefined && v.longitude !== '' && Number.isFinite(Number(v.longitude));
    if (!address && !(latOk && lngOk)) {
      throw new Error('Either address OR (latitude and longitude) is required');
    }

    // If client provides partial service geo fields, reject.
    const serviceLatProvided = v.service_latitude !== undefined && v.service_latitude !== null && v.service_latitude !== '';
    const serviceLngProvided = v.service_longitude !== undefined && v.service_longitude !== null && v.service_longitude !== '';
    if (serviceLatProvided !== serviceLngProvided) {
      throw new Error('Either both (service_latitude and service_longitude) are required');
    }

    return true;
  })
];

const bookingIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

const serviceDetailsValidation = [
  ...bookingIdParamValidation,
  evAccountCardOnFileValidation,
  body('package_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('package_id must be a positive integer'),
  body('custom_package_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ min: 1, max: 160 })
    .withMessage('custom_package_name must be 1-160 chars'),
  body('custom_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('custom_price must be >= 0'),
  body('service_address').optional({ nullable: true }).isString().withMessage('service_address must be a string'),
  body('service_latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('service_latitude is invalid'),
  body('service_longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('service_longitude is invalid'),
  body('service_location_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('service_location_name must be at most 255 chars'),

  // EV charging location (for ev_charging + combo)
  body('ev_charging_address').optional({ nullable: true }).isString().withMessage('ev_charging_address must be a string'),
  body('charging_latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('charging_latitude is invalid'),
  body('charging_longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('charging_longitude is invalid'),
  body('ev_charging_location_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('ev_charging_location_name must be at most 255 chars'),
  body('charger_type')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      if (!isValidEvChargerType(v)) {
        throw new Error(`charger_type must be one of: ${[...EV_CHARGER_TYPE_VALUES].join(', ')}`);
      }
      return true;
    }),

  body('schedule_type')
    .optional({ nullable: true })
    .isIn(CUSTOMER_SCHEDULE_TYPES)
    .withMessage('schedule_type must be asap or scheduled'),
  body('scheduled_at').optional({ nullable: true }).isISO8601().withMessage('scheduled_at must be a valid datetime'),
  body().custom((v) => {
    const hasPackage = !!v.package_id;
    const hasCustomName = !!(v.custom_package_name && String(v.custom_package_name).trim());
    const hasCustomPrice = !(v.custom_price === undefined || v.custom_price === null || v.custom_price === '');

    // If a client passes custom fields, they must come as a pair.
    if (hasCustomName !== hasCustomPrice) {
      throw new Error('Provide both custom_package_name and custom_price');
    }

    // Only one of (package_id) vs (custom_package_*) can be provided.
    if (hasPackage && (hasCustomName || hasCustomPrice)) throw new Error('Provide either package_id or custom_package fields, not both');

    const hasChargingLat = v.charging_latitude !== undefined && v.charging_latitude !== null && v.charging_latitude !== '';
    const hasChargingLng = v.charging_longitude !== undefined && v.charging_longitude !== null && v.charging_longitude !== '';
    if (hasChargingLat !== hasChargingLng) {
      throw new Error('Either both charging_latitude and charging_longitude are required');
    }

    let scheduleType = v.schedule_type === null ? null : v.schedule_type ? String(v.schedule_type).trim() : null;
    const scheduledAt = v.scheduled_at === null ? null : v.scheduled_at ? String(v.scheduled_at).trim() : null;
    if (scheduleType && String(scheduleType).toLowerCase().replace(/-/g, '_') === 'on_demand') {
      scheduleType = scheduledAt ? 'scheduled' : 'asap';
    }

    // Both can be nullable, but must be coherent:
    // - At least one must be provided
    // - No scheduled_at without schedule_type
    // - If schedule_type is 'scheduled' then scheduled_at is required
    if (!scheduleType && !scheduledAt) throw new Error('Either schedule_type or scheduled_at is required');
    if (!scheduleType && scheduledAt) throw new Error('schedule_type is required when scheduled_at is provided');
    if (scheduleType === 'scheduled' && !scheduledAt) throw new Error('scheduled_at is required when schedule_type is scheduled');
    return true;
  })
];

const vehicleDetailsValidation = [
  ...bookingIdParamValidation,
  evAccountCardOnFileValidation,
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id is required'),
  body('vehicle_charge_limit')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      const n = Number.parseInt(String(v), 10);
      if (!isValidEvVehicleChargeLimitPercent(n)) {
        throw new Error('vehicle_charge_limit must be one of: 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100');
      }
      return true;
    }),
  body('current_battery_status')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      if (!EV_BATTERY_STATUS_VALUES.has(String(v).trim())) {
        throw new Error('current_battery_status is invalid');
      }
      return true;
    }),
  body('current_battery_charge')
    .optional({ nullable: true })
    .custom((v, { req }) => {
      if (v === undefined || v === null || v === '') return true;
      const statusCode = req.body?.current_battery_status;
      if (statusCode !== undefined && statusCode !== null && String(statusCode).trim()) return true;
      const resolved = resolveEvBatteryStatusFromInput({ chargePercent: v });
      if (!resolved) {
        throw new Error('current_battery_charge must match a supported battery status option');
      }
      return true;
    }),
  body('service_notes')
    .optional({ nullable: true })
    .isString()
    .withMessage('service_notes must be a string'),
  body('rate_per_kw')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('rate_per_kw must be a non-negative number'),
  body('parking_instructions').optional({ nullable: true }).isString().withMessage('parking_instructions must be a string'),
  body('notes').optional({ nullable: true }).isString().withMessage('notes must be a string'),
  body('vehicle_parked_location').notEmpty().withMessage('vehicle_parked_location is required').isString(),
  body('provider_park_location').notEmpty().withMessage('provider_park_location is required').isString(),
  body('vehicle_key_location').notEmpty().withMessage('vehicle_key_location is required').isString(),
  body('key_return_location').notEmpty().withMessage('key_return_location is required').isString(),
  body('vehicle_parked_location_other').optional({ nullable: true }).isString(),
  body('provider_park_location_other').optional({ nullable: true }).isString(),
  body('vehicle_key_location_other').optional({ nullable: true }).isString(),
  body('key_return_location_other').optional({ nullable: true }).isString()
];

const confirmValidation = [
  ...bookingIdParamValidation,
  body('payment_method_id')
    .notEmpty()
    .withMessage('payment_method_id is required')
    .isString()
    .isLength({ min: 3, max: 255 })
    .withMessage('payment_method_id must be a string'),
  body('payment_method_id')
    .matches(/^pm_[A-Za-z0-9_]+$/)
    .withMessage('payment_method_id must be a valid Stripe PaymentMethod id')
];

const locationUpdateValidation = [
  ...bookingIdParamValidation,
  evAccountCardOnFileValidation,
  body('address').optional({ nullable: true }).isString().withMessage('address must be a string'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('latitude is invalid'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('longitude is invalid'),
  body('service_address').optional({ nullable: true }).isString().withMessage('service_address must be a string'),
  body('service_latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('service_latitude is invalid'),
  body('service_longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('service_longitude is invalid'),
  body('service_location_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('service_location_name must be at most 255 chars'),
  body('ev_charging_address').optional({ nullable: true }).isString().withMessage('ev_charging_address must be a string'),
  body('charging_latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('charging_latitude is invalid'),
  body('charging_longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('charging_longitude is invalid'),
  body('ev_charging_location_name')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('ev_charging_location_name must be at most 255 chars'),
  body('charger_type')
    .optional({ nullable: true })
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      if (!isValidEvChargerType(v)) {
        throw new Error(`charger_type must be one of: ${[...EV_CHARGER_TYPE_VALUES].join(', ')}`);
      }
      return true;
    }),
  body().custom((v) => {
    const address = v.address === null ? null : String(v.address || '').trim() || null;
    const latOk =
      v.latitude !== undefined &&
      v.latitude !== null &&
      v.latitude !== '' &&
      Number.isFinite(Number(v.latitude));
    const lngOk =
      v.longitude !== undefined &&
      v.longitude !== null &&
      v.longitude !== '' &&
      Number.isFinite(Number(v.longitude));
    if (!address && !(latOk && lngOk)) {
      throw new Error('Either address OR (latitude and longitude) is required');
    }

    const serviceLatProvided =
      v.service_latitude !== undefined && v.service_latitude !== null && v.service_latitude !== '';
    const serviceLngProvided =
      v.service_longitude !== undefined && v.service_longitude !== null && v.service_longitude !== '';
    if (serviceLatProvided !== serviceLngProvided) {
      throw new Error('Either both (service_latitude and service_longitude) are required');
    }

    const chargingLatProvided =
      v.charging_latitude !== undefined && v.charging_latitude !== null && v.charging_latitude !== '';
    const chargingLngProvided =
      v.charging_longitude !== undefined && v.charging_longitude !== null && v.charging_longitude !== '';
    if (chargingLatProvided !== chargingLngProvided) {
      throw new Error('Either both charging_latitude and charging_longitude are required');
    }

    return true;
  }),
];

module.exports = {
  startBookingValidation,
  locationUpdateValidation,
  serviceDetailsValidation,
  vehicleDetailsValidation,
  bookingIdParamValidation,
  confirmValidation
};
