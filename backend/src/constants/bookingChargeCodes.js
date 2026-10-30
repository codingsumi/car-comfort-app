const BOOKING_CHARGE_CODES = {
  TOWING_SERVICES: 'towing_services',
  ON_DEMAND_SERVICES: 'on_demand_services',
  CONVENIENCE_FEE: 'convenience_fee',
  CUSTOMER_NO_SHOW_FEE: 'customer_no_show_fee',
  CUSTOMER_CANCELLATION_FEE: 'customer_cancellation_fee',
  /** Fixed fee when a customer enters a preferred/custom car wash package (not preset packages). */
  CARCOMFORT_SERVICE_FEE: 'carcomfort_service_fee',
};

const BOOKING_CHARGE_LABELS = {
  [BOOKING_CHARGE_CODES.TOWING_SERVICES]: 'Towing Services',
  [BOOKING_CHARGE_CODES.ON_DEMAND_SERVICES]: 'On-Demand services',
  [BOOKING_CHARGE_CODES.CONVENIENCE_FEE]: 'Convenience fee',
  [BOOKING_CHARGE_CODES.CUSTOMER_NO_SHOW_FEE]: 'Customer no show fee',
  [BOOKING_CHARGE_CODES.CUSTOMER_CANCELLATION_FEE]: 'Customer cancellation fee',
  [BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE]: 'CarComfort service fee',
};

/** System charges that can be activated/deactivated but not deleted from admin. */
const NON_DELETABLE_BOOKING_CHARGE_CODES = new Set([
  BOOKING_CHARGE_CODES.CARCOMFORT_SERVICE_FEE,
]);

const DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT = 99;

module.exports = {
  BOOKING_CHARGE_CODES,
  BOOKING_CHARGE_LABELS,
  NON_DELETABLE_BOOKING_CHARGE_CODES,
  DEFAULT_CARCOMFORT_SERVICE_FEE_AMOUNT,
};
