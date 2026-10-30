'use strict';

const {
  resolveBookingProviderCompensationAmount,
  resolveComboProviderCompensationAmount,
  pickComboCompensationPackageRow,
  roundTwo,
} = require('./providerCompensation');
const {
  getDrivingRouteDistanceMeters,
  geocodeAddressToCoords,
} = require('../services/mapbox.service');
const { logger } = require('../config/logger');

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineMiles({ lat1, lng1, lat2, lng2 }) {
  const a1 = toNumberOrNull(lat1);
  const o1 = toNumberOrNull(lng1);
  const a2 = toNumberOrNull(lat2);
  const o2 = toNumberOrNull(lng2);
  if (a1 === null || o1 === null || a2 === null || o2 === null) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const Rm = 3958.7613;
  const dLat = toRad(a2 - a1);
  const dLng = toRad(o2 - o1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const q = s1 * s1 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  return Rm * c;
}

/** Urban driving estimate (~30 mph). */
function estimateTravelMinutesFromMiles(miles) {
  if (miles == null || !Number.isFinite(miles) || miles <= 0) return 0;
  return Math.max(1, Math.round((miles / 30) * 60));
}

function formatUsd(amount) {
  const n = toNumberOrNull(amount);
  if (n === null || n <= 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function coordPair(lat, lng) {
  const a = toNumberOrNull(lat);
  const o = toNumberOrNull(lng);
  if (a === null || o === null) return null;
  return { lat: a, lng: o };
}

function normalizeAddress(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function addressesDiffer(a, b) {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  if (!left || !right) return false;
  return left !== right;
}

function resolvePickupCoords(plain) {
  return (
    coordPair(plain.latitude ?? plain.pickup_latitude, plain.longitude ?? plain.pickup_longitude) ||
    coordPair(plain.user?.latitude, plain.user?.longitude)
  );
}

function resolveCarWashCoords(plain) {
  return coordPair(
    plain.service_latitude ?? plain.service_lat,
    plain.service_longitude ?? plain.service_lng
  );
}

function resolveChargingCoords(plain) {
  return coordPair(plain.charging_latitude, plain.charging_longitude);
}

function resolveEvServiceDisplayAddress(plain) {
  const evAddress = String(plain?.ev_charging_address || '').trim();
  if (evAddress) return evAddress;
  return String(plain?.service_address || '').trim();
}

/**
 * EV service stop coords aligned with Route Plan address selection:
 * prefer EV address + charging coords, otherwise service address + service coords.
 */
function resolveEvServiceStopCoords(plain, pickup = null) {
  const pickupCoords = pickup || resolvePickupCoords(plain);
  const evAddress = String(plain?.ev_charging_address || '').trim();
  const serviceAddress = String(plain?.service_address || '').trim();
  const pickupAddress = String(plain?.address || '').trim();
  const charge = resolveChargingCoords(plain);
  const wash = resolveCarWashCoords(plain);

  const displayAddress = evAddress || serviceAddress;
  const preferChargeCoords = Boolean(evAddress) || (!serviceAddress && charge != null);

  let stop = preferChargeCoords ? charge || wash : wash || charge;

  if (stop && pickupCoords && coordsNearlyEqual(stop, pickupCoords)) {
    const addrsDiffer = addressesDiffer(displayAddress, pickupAddress);
    if (addrsDiffer) {
      stop = preferChargeCoords ? wash : charge;
      if (stop && coordsNearlyEqual(stop, pickupCoords)) stop = null;
    }
  }

  return stop;
}

function resolveCarWashServiceStopCoords(plain, pickup = null) {
  const pickupCoords = pickup || resolvePickupCoords(plain);
  const wash = resolveCarWashCoords(plain);
  if (!wash || !pickupCoords) return wash;

  const serviceAddress = String(plain?.service_address || '').trim();
  const pickupAddress = String(plain?.address || '').trim();
  if (
    coordsNearlyEqual(wash, pickupCoords) &&
    addressesDiffer(serviceAddress, pickupAddress)
  ) {
    return null;
  }

  return wash;
}

async function resolveEvServiceStopCoordsWithGeocode(plain, pickup = null) {
  const pickupCoords = pickup || resolvePickupCoords(plain);
  let stop = resolveEvServiceStopCoords(plain, pickupCoords);
  const serviceAddr = resolveEvServiceDisplayAddress(plain);
  const pickupAddr = String(plain?.address || '').trim();

  if (!serviceAddr || !addressesDiffer(pickupAddr, serviceAddr)) {
    return stop;
  }

  try {
    const geocoded = await geocodeAddressToCoords(serviceAddr);
    if (!geocoded) {
      // Geocoding unavailable (e.g. no Mapbox token / request failed): trust the
      // explicit customer-selected charging coordinates rather than dropping a
      // legitimate short leg. EV stations are chosen within a few miles of the
      // pickup, so a sub-3-mile trip is normal and must still yield a radius
      // instead of surfacing "—" on the Service Details screen.
      return stop;
    }

    if (!stop || (pickupCoords && coordsNearlyEqual(stop, pickupCoords))) {
      return geocoded;
    }

    const driftMiles = haversineMiles({
      lat1: stop.lat,
      lng1: stop.lng,
      lat2: geocoded.lat,
      lng2: geocoded.lng,
    });
    if (driftMiles != null && driftMiles > 1.5) {
      return geocoded;
    }
  } catch (err) {
    logger.debug('resolve_ev_service_stop_geocode_fallback', {
      bookingId: plain?.id,
      message: err?.message,
    });
    // On geocode failure, keep the explicit stop coordinates (see note above).
  }

  return stop;
}

async function resolveCarWashServiceStopCoordsWithGeocode(plain, pickup = null) {
  const pickupCoords = pickup || resolvePickupCoords(plain);
  let stop = resolveCarWashServiceStopCoords(plain, pickupCoords);
  const serviceAddr = String(plain?.service_address || '').trim();
  const pickupAddr = String(plain?.address || '').trim();

  if (!serviceAddr || !addressesDiffer(pickupAddr, serviceAddr)) {
    return stop;
  }

  try {
    const geocoded = await geocodeAddressToCoords(serviceAddr);
    if (!geocoded) {
      // Geocoding unavailable: trust the explicit service coordinates instead of
      // dropping a legitimate short leg (which would surface as "—" radius).
      return stop;
    }

    if (!stop || (pickupCoords && coordsNearlyEqual(stop, pickupCoords))) {
      return geocoded;
    }

    const driftMiles = haversineMiles({
      lat1: stop.lat,
      lng1: stop.lng,
      lat2: geocoded.lat,
      lng2: geocoded.lng,
    });
    if (driftMiles != null && driftMiles > 1.5) {
      return geocoded;
    }
  } catch (err) {
    logger.debug('resolve_car_wash_service_stop_geocode_fallback', {
      bookingId: plain?.id,
      message: err?.message,
    });
    // On geocode failure, keep the explicit stop coordinates (see note above).
  }

  return stop;
}

function isSuspiciouslyShortLeg(pickupCoords, stopCoords, serviceAddr, pickupAddr) {
  if (!addressesDiffer(pickupAddr, serviceAddr)) return false;
  const oneWay = haversineMiles({
    lat1: pickupCoords.lat,
    lng1: pickupCoords.lng,
    lat2: stopCoords.lat,
    lng2: stopCoords.lng,
  });
  return oneWay != null && oneWay < 3;
}

function suppressSuspiciousEvTravelMiles(plain, miles) {
  if (String(plain?.service_type || '').trim() !== 'ev_charging') return miles;
  if (miles == null || miles >= 3) return miles;

  const pickup = resolvePickupCoords(plain);
  const stop = resolveEvServiceStopCoords(plain, pickup);
  if (!pickup || !stop) return miles;

  const serviceAddr = resolveEvServiceDisplayAddress(plain);
  const pickupAddr = String(plain?.address || '').trim();
  if (isSuspiciouslyShortLeg(pickup, stop, serviceAddr, pickupAddr)) {
    return null;
  }

  return miles;
}

/**
 * Ordered route waypoints for travel-time estimates.
 * Combo: pickup → EV charging → car wash (matches combo_service_stop_index).
 */
function buildDriverJobRouteCoords(plain, options = {}) {
  const pickup = resolvePickupCoords(plain);
  const serviceType = String(plain?.service_type || '').trim();
  const resolveEvServiceStop = options.resolveEvServiceStop || resolveEvServiceStopCoords;
  const resolveCarWashStop = options.resolveCarWashStop || resolveCarWashServiceStopCoords;

  if (serviceType === 'combo') {
    const charge = resolveEvServiceStop(plain, pickup) || resolveChargingCoords(plain);
    const wash = resolveCarWashStop(plain, pickup);
    return [pickup, charge, wash].filter(Boolean);
  }

  if (serviceType === 'ev_charging') {
    const stop = resolveEvServiceStop(plain, pickup);
    return [pickup, stop].filter(Boolean);
  }

  const wash = resolveCarWashStop(plain, pickup);
  return [pickup, wash].filter(Boolean);
}

function estimateRouteTravelMiles(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const miles = haversineMiles({
      lat1: coords[i].lat,
      lng1: coords[i].lng,
      lat2: coords[i + 1].lat,
      lng2: coords[i + 1].lng,
    });
    if (miles != null && miles > 0) total += miles;
  }
  return total > 0 ? total : null;
}

function coordsNearlyEqual(a, b) {
  if (!a || !b) return false;
  const latDiff = Math.abs(a.lat - b.lat);
  const lngDiff = Math.abs(a.lng - b.lng);
  return latDiff < 0.00005 && lngDiff < 0.00005;
}

/** Append return leg to customer pickup when the route does not already end there. */
function withReturnToPickup(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return coords || [];
  const pickup = coords[0];
  const last = coords[coords.length - 1];
  if (coordsNearlyEqual(pickup, last)) return coords;
  return [...coords, pickup];
}

function buildDriverJobRoundTripRouteCoords(plain, options = {}) {
  return withReturnToPickup(buildDriverJobRouteCoords(plain, options));
}

function estimateRouteTravelMinutes(coords) {
  const miles = estimateRouteTravelMiles(coords);
  if (miles == null) return 0;
  return estimateTravelMinutesFromMiles(miles);
}

function resolveServiceDurationMinutes(
  plain,
  packageRow = null,
  evPackageRow = null,
  comboPackageRow = null
) {
  // 1. Use the value already stored on the booking record (written at confirm time).
  const stored =
    plain?.service_duration_minutes != null
      ? Number(plain.service_duration_minutes)
      : plain?.duration_minutes != null
        ? Number(plain.duration_minutes)
        : null;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  const serviceType = String(plain?.service_type || '').trim();

  // 2. For combo bookings, prefer the dedicated combo package row (which holds
  //    the admin-configured combined duration) over the booking's own package
  //    row (which may point to a car-wash-only package with a shorter duration).
  if (serviceType === 'combo') {
    const pkgServiceName = String(packageRow?.service?.name || packageRow?.Service?.name || '').trim().toLowerCase();
    const comboPkg = comboPackageRow || (pkgServiceName === 'combo' ? packageRow : null);
    const comboDuration = toNumberOrNull(comboPkg?.duration_minutes);
    if (comboDuration != null && comboDuration > 0) return comboDuration;

    // Fallback: car wash pkg duration + EV pkg duration
    const pkg = packageRow || plain?.package || null;
    const evPkg = evPackageRow || null;
    const carWashDuration = toNumberOrNull(pkg?.duration_minutes);
    const evDuration = toNumberOrNull(evPkg?.duration_minutes);
    if (carWashDuration != null && evDuration != null && carWashDuration > 0 && evDuration > 0) {
      return carWashDuration + evDuration;
    }
    if (carWashDuration != null && carWashDuration > 0) return carWashDuration;
    if (evDuration != null && evDuration > 0) return evDuration;
  }

  // 3. Non-combo: use the package row directly.
  const pkg = packageRow || plain?.package || null;
  const pkgDuration = toNumberOrNull(pkg?.duration_minutes);
  if (pkgDuration != null && pkgDuration > 0) return pkgDuration;

  return fallbackServiceDurationMinutes(plain, pkg);
}

function fallbackServiceDurationMinutes(plain, packageRow = null) {
  const pkg = packageRow || plain?.package || null;
  const name = String(plain?.custom_package_name || pkg?.name || '')
    .trim()
    .toLowerCase();
  if (name.includes('basic') && name.includes('wash')) return 30;
  if (name.includes('deluxe')) return 35;
  if (name.includes('ultimate')) return 40;
  if (name.includes('premium') && name.includes('wash')) return 45;
  if (name.includes('premium combo') || name.includes('premium wash')) return 45;
  if (name.includes('quick combo')) return 60;
  if (name.includes('combo')) return 60;

  const serviceType = String(plain?.service_type || '').trim();
  if (serviceType === 'combo') return 60;
  if (serviceType === 'ev_charging') return 40;
  if (serviceType === 'car_wash') return 30;
  return 30;
}

/**
 * Pickup → service stop(s) travel + package service duration for driver job-board pins.
 */
function buildDriverJobMapSummary(
  bookingPlain,
  packageRow = null,
  evPackageRow = null,
  comboPackageRow = null
) {
  const plain = bookingPlain || {};
  const pkg = packageRow || plain.package || null;

  const routeCoords = buildDriverJobRoundTripRouteCoords(plain);
  const estimatedTravelMinutes = estimateRouteTravelMinutes(routeCoords);
  const estimatedTravelMiles = suppressSuspiciousEvTravelMiles(
    plain,
    estimateRouteTravelMiles(routeCoords)
  );

  const serviceDurationMinutes = resolveServiceDurationMinutes(plain, pkg, evPackageRow, comboPackageRow);

  // Service time only — travel is exposed separately as estimated_travel_minutes.
  const estimatedCompletionMinutes = serviceDurationMinutes;

  const estimatedTotalJobMinutes =
    (serviceDurationMinutes ?? 0) + (estimatedTravelMinutes > 0 ? estimatedTravelMinutes : 0);

  const serviceType = String(plain?.service_type || '').trim();
  const comboPkg = pickComboCompensationPackageRow(pkg, comboPackageRow);
  let providerEarning = 0;
  if (serviceType === 'combo' && comboPkg) {
    providerEarning = resolveComboProviderCompensationAmount({
      booking: plain,
      comboPackageRow: comboPkg,
      scheduleType: plain.schedule_type,
      basePrice: comboPkg.base_price,
    });
  } else {
    providerEarning = resolveBookingProviderCompensationAmount(plain, pkg, comboPkg);
  }
  providerEarning = roundTwo(Math.max(0, providerEarning));

  const pickup = resolvePickupCoords(plain);

  return {
    package_id: plain.package_id ?? pkg?.id ?? null,
    package_name: pkg?.name ?? plain.custom_package_name ?? null,
    service_duration_minutes: serviceDurationMinutes,
    estimated_travel_minutes: estimatedTravelMinutes > 0 ? estimatedTravelMinutes : null,
    estimated_travel_miles:
      estimatedTravelMiles != null && estimatedTravelMiles > 0
        ? Number(estimatedTravelMiles.toFixed(2))
        : null,
    estimated_completion_minutes:
      estimatedCompletionMinutes != null && estimatedCompletionMinutes > 0
        ? estimatedCompletionMinutes
        : null,
    estimated_total_job_minutes:
      estimatedTotalJobMinutes > 0 ? estimatedTotalJobMinutes : null,
    provider_earning: providerEarning > 0 ? providerEarning : null,
    provider_earning_display: formatUsd(providerEarning),
    pickup_location:
      pickup != null
        ? { latitude: pickup.lat, longitude: pickup.lng }
        : null,
  };
}

/**
 * Driving distance when Mapbox is configured; otherwise straight-line round-trip miles.
 */
async function resolveEstimatedTravelMiles(
  bookingPlain,
  packageRow = null,
  evPackageRow = null,
  comboPackageRow = null
) {
  void packageRow;
  void evPackageRow;
  void comboPackageRow;

  const plain = bookingPlain || {};
  const serviceType = String(plain?.service_type || '').trim();
  const pickup = resolvePickupCoords(plain);

  let resolveEvServiceStop = resolveEvServiceStopCoords;
  if (serviceType === 'ev_charging' || serviceType === 'combo') {
    const geocodedEv = await resolveEvServiceStopCoordsWithGeocode(plain, pickup);
    resolveEvServiceStop = () => geocodedEv;
  }

  let resolveCarWashStop = resolveCarWashServiceStopCoords;
  if (serviceType === 'car_wash' || serviceType === 'combo') {
    const geocodedWash = await resolveCarWashServiceStopCoordsWithGeocode(plain, pickup);
    resolveCarWashStop = () => geocodedWash;
  }

  const coords = buildDriverJobRoundTripRouteCoords(plain, {
    resolveEvServiceStop,
    resolveCarWashStop,
  });
  let miles = estimateRouteTravelMiles(coords);

  try {
    const meters = await getDrivingRouteDistanceMeters(coords);
    if (meters != null && Number.isFinite(meters) && meters > 0) {
      miles = meters / 1609.344;
    }
  } catch (err) {
    logger.debug('resolve_estimated_travel_miles_mapbox_fallback', {
      bookingId: plain.id,
      message: err?.message,
    });
  }

  if (miles == null || !Number.isFinite(miles) || miles <= 0) return null;
  // NOTE: Do not re-apply suppressSuspiciousEvTravelMiles here. The EV/car-wash
  // stop resolvers above already geocode and drop degenerate stops (returning a
  // null stop -> null miles). Re-running the short-leg suppression with the raw
  // (non-geocoded) coords wrongly nulls out legitimate short EV trips (< 3 mi),
  // which surfaces as "—" for Estimated Radius on the Service Details screen.
  return Number(miles.toFixed(2));
}

module.exports = {
  haversineMiles,
  estimateTravelMinutesFromMiles,
  buildDriverJobRouteCoords,
  buildDriverJobRoundTripRouteCoords,
  withReturnToPickup,
  estimateRouteTravelMiles,
  estimateRouteTravelMinutes,
  resolveEstimatedTravelMiles,
  buildDriverJobMapSummary,
  resolveEvServiceStopCoords,
  resolveEvServiceDisplayAddress,
  resolveServiceDurationMinutes,
};
