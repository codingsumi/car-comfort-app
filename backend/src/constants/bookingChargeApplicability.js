'use strict';

/** Where a booking charge applies in the customer app / pricing. */
const BOOKING_CHARGE_SERVICE_APPLICABILITY = {
  ALL: 'all',
  CAR_WASH: 'car_wash',
  EV_CHARGING: 'ev_charging',
};

const APPLICABILITY_LABELS = {
  [BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL]: 'All services',
  [BOOKING_CHARGE_SERVICE_APPLICABILITY.CAR_WASH]: 'Car wash only',
  [BOOKING_CHARGE_SERVICE_APPLICABILITY.EV_CHARGING]: 'EV charging only',
};

function normalizeServiceApplicability(value) {
  const raw = String(value || BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL)
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (raw === 'both' || raw === 'all' || raw === 'all_services') {
    return BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL;
  }
  if (raw === 'car' || raw === 'car_wash') {
    return BOOKING_CHARGE_SERVICE_APPLICABILITY.CAR_WASH;
  }
  if (raw === 'ev' || raw === 'ev_charging') {
    return BOOKING_CHARGE_SERVICE_APPLICABILITY.EV_CHARGING;
  }
  return BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL;
}

function chargeAppliesToServiceType(applicability, serviceType) {
  const app = normalizeServiceApplicability(applicability);
  const svc = String(serviceType || '')
    .trim()
    .toLowerCase();
  if (!svc || app === BOOKING_CHARGE_SERVICE_APPLICABILITY.ALL) return true;
  if (app === BOOKING_CHARGE_SERVICE_APPLICABILITY.CAR_WASH) {
    return svc === 'car_wash' || svc === 'combo';
  }
  if (app === BOOKING_CHARGE_SERVICE_APPLICABILITY.EV_CHARGING) {
    return svc === 'ev_charging' || svc === 'combo';
  }
  return true;
}

module.exports = {
  BOOKING_CHARGE_SERVICE_APPLICABILITY,
  APPLICABILITY_LABELS,
  normalizeServiceApplicability,
  chargeAppliesToServiceType,
};
