const { Op } = require('sequelize');

const db = require('../models');
const { HttpError } = require('../utils/httpError');
const { createDraftBooking, getBookingOrThrow, updateBooking, getReviewBundle } = require('../repositories/booking.repository');
const { generateBookingCode } = require('../repositories/bookingCode.repository');
const { calcEvChargingCost } = require('./pricing.service');
const {
  resolveReferralDiscountTypeForBooking,
  consumeReferralDiscount
} = require('./referralDiscount.service');
const {
  buildBookingPriceSummary,
  calcCustomerBookingPricing,
  applyProviderCompensationToPricing,
  syncPricingTotalsFromPriceSummary,
  resolveEvChargingPackageRow,
  resolveComboServicePackageRow,
  resolveCarWashPackageRow,
} = require('./bookingPriceSummary.service');
const { createAndConfirmPaymentIntent } = require('./bookingPayment.service');
const { recordPromotionUse } = require('./promotionalDiscount.service');
const { resolveServiceDurationMinutes } = require('../utils/driverJobMapSummary');
const { sendBookingConfirmedNotifications } = require('./bookingNotification.service');
const { notifyCustomerBookingConfirmed } = require('./bookingCustomerNotify.service');
const { notifyAdminNewBooking } = require('./adminBookingNotify.service');
const { notifyNearbyDriversBookingCreated } = require('../modules/bookings/bookingCreatedNotify.service');
const { logger } = require('../config/logger');
const { resolveProviderCompensationFromPackage, resolveComboProviderCompensationAmount } = require('../utils/providerCompensation');
const { bufferToWebp, saveWebpFile, ensureAbsoluteUrl } = require('../utils/fileUpload');
const { BOOKING_IMAGE_TYPES } = require('../constants/bookingImageTypes');
const {
  normalizeEvChargerTypeInput,
  isValidEvChargerType,
  isValidEvVehicleChargeLimitPercent,
  resolveEvBatteryStatusFromInput,
  getEvChargingBookingOptions,
  getEvBatteryStatusLabel,
  EV_CHARGER_TYPES,
} = require('../constants/evChargingBooking');
const {
  parseServiceNotesBody,
  formatServiceNotesSummary,
  buildServiceNotesResponse,
  assertServiceNotesComplete
} = require('../constants/bookingServiceNotes');

const SERVICE_TYPES = new Set(['car_wash', 'ev_charging', 'combo']);
const CUSTOMER_SCHEDULE_TYPES = new Set(['asap', 'scheduled']);

function parseOptionalEvAccountCardOnFile(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new HttpError(400, 'ev_account_card_on_file must be true or false');
}

function normalizeCustomerScheduleType(scheduleType, scheduledAt) {
  const normalized = String(scheduleType || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (normalized === 'on_demand') {
    return scheduledAt ? 'scheduled' : 'asap';
  }
  return normalized;
}
const { resolveEffectiveScheduleType } = require('../utils/bookingSchedulePolicy');

function getServiceTypeLabel(serviceType) {
  switch (serviceType) {
    case 'car_wash':
      return 'Car Wash';
    case 'ev_charging':
      return 'EV Charging';
    case 'combo':
      return 'EV Charging + Car Wash';
    default:
      return String(serviceType);
  }
}

function assertEditableStatus(status) {
  if (['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    throw new HttpError(400, 'Booking cannot be edited in current status');
  }
}

function assertStep1Complete(b) {
  if (!b.service_type) throw new HttpError(400, 'service_type missing');
  const hasManual = !!(b.address && String(b.address).trim());
  const hasGeo = b.latitude !== null && b.latitude !== undefined && b.longitude !== null && b.longitude !== undefined;
  if (!hasManual && !hasGeo) throw new HttpError(400, 'Location details missing');
}

function assertStep2Complete(b) {
  if (!b.schedule_type) throw new HttpError(400, 'schedule_type missing');
  if (b.schedule_type === 'scheduled' && !b.scheduled_at) throw new HttpError(400, 'scheduled_at missing');

  const hasPackage = !!b.package_id;
  const hasCustom = !!(b.custom_package_name && b.custom_price !== null && b.custom_price !== undefined);
  const hasPackageOrCustom = hasPackage || hasCustom;

  const hasServiceManual = !!(b.service_address && String(b.service_address).trim());
  const hasServiceGeo =
    b.service_latitude !== null &&
    b.service_latitude !== undefined &&
    b.service_longitude !== null &&
    b.service_longitude !== undefined;
  const hasServiceLocation = hasServiceManual || hasServiceGeo;

  if (b.service_type === 'car_wash') {
    if (!hasPackageOrCustom) throw new HttpError(400, 'Service details missing');
    return;
  }

  if (b.service_type === 'ev_charging') {
    if (!hasServiceLocation) throw new HttpError(400, 'Service location details missing');
    if (!isValidEvChargerType(b.charger_type)) throw new HttpError(400, 'charger_type missing');
    if (typeof b.ev_account_card_on_file !== 'boolean') {
      throw new HttpError(400, 'ev_account_card_on_file missing');
    }
    return;
  }

  if (b.service_type === 'combo') {
    if (!hasPackageOrCustom) throw new HttpError(400, 'Service details missing');
    if (!hasServiceLocation) throw new HttpError(400, 'Service location details missing');
    if (typeof b.ev_account_card_on_file !== 'boolean') {
      throw new HttpError(400, 'ev_account_card_on_file missing');
    }
    return;
  }

  throw new HttpError(400, 'Invalid service_type');
}

function isValidVehicleChargeLimitPercent(n) {
  return isValidEvVehicleChargeLimitPercent(n);
}

function resolveBatteryFieldsFromBody(body) {
  const statusCode =
    body.current_battery_status !== undefined && body.current_battery_status !== null
      ? String(body.current_battery_status).trim()
      : '';
  const rawCharge = body.current_battery_charge;

  if (statusCode) {
    const resolved = resolveEvBatteryStatusFromInput({ statusCode });
    if (!resolved) throw new HttpError(400, 'current_battery_status is invalid');
    return resolved;
  }

  if (rawCharge === undefined || rawCharge === null || rawCharge === '') {
    return null;
  }

  const resolved = resolveEvBatteryStatusFromInput({ chargePercent: rawCharge });
  if (!resolved) {
    throw new HttpError(400, 'current_battery_charge must match a supported battery status option');
  }
  return resolved;
}

function packageAllowedForBookingServiceType(packageServiceName, bookingServiceType) {
  const pkgSvc = String(packageServiceName || '').trim();
  const bookingSvc = String(bookingServiceType || '').trim();
  if (pkgSvc === bookingSvc) return true;
  // Combo bookings pick a car wash package on the wash step.
  if (bookingSvc === 'combo' && pkgSvc === 'car_wash') return true;
  return false;
}

function assertStep3Complete(b) {
  if (!b.vehicle_id) throw new HttpError(400, 'vehicle_id missing');
  if (b.service_type === 'ev_charging' || b.service_type === 'combo') {
    const n = Number.parseInt(String(b.vehicle_charge_limit ?? ''), 10);
    if (!isValidVehicleChargeLimitPercent(n)) {
      throw new HttpError(400, 'vehicle_charge_limit missing');
    }
  }
  try {
    assertServiceNotesComplete(b);
  } catch (err) {
    throw new HttpError(400, err?.message || 'service notes incomplete');
  }
}

async function startBooking(req, { userId, body }) {
  const service_type = String(body.service_type || '').trim();
  if (!SERVICE_TYPES.has(service_type)) throw new HttpError(400, 'Invalid service_type');

  const address = body.address === null ? null : String(body.address || '').trim() || null;
  const latitude = body.latitude === undefined || body.latitude === null || body.latitude === '' ? null : Number(body.latitude);
  const longitude = body.longitude === undefined || body.longitude === null || body.longitude === '' ? null : Number(body.longitude);

  let charger_type = null;
  if (body.charger_type !== undefined && body.charger_type !== null && String(body.charger_type).trim()) {
    charger_type = normalizeEvChargerTypeInput(body.charger_type);
    if (!charger_type) {
      throw new HttpError(400, 'charger_type is invalid');
    }
    if (service_type !== 'ev_charging') {
      throw new HttpError(400, 'charger_type is only allowed for ev_charging');
    }
  }

  let service_address = body.service_address === null ? null : String(body.service_address || '').trim() || null;
  let service_latitude =
    body.service_latitude === undefined || body.service_latitude === null || body.service_latitude === ''
      ? null
      : Number(body.service_latitude);
  let service_longitude =
    body.service_longitude === undefined || body.service_longitude === null || body.service_longitude === ''
      ? null
      : Number(body.service_longitude);
  const service_location_name =
    body.service_location_name === undefined || body.service_location_name === null
      ? null
      : String(body.service_location_name || '').trim() || null;
  const ev_account_card_on_file = parseOptionalEvAccountCardOnFile(body.ev_account_card_on_file);

  const hasManual = !!address;
  const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!hasManual && !hasGeo) throw new HttpError(400, 'Either address or (latitude, longitude) is required');

  const t = await db.sequelize.transaction();
  try {
    // Car wash: service location defaults to the customer's location.
    if (service_type === 'car_wash') {
      const hasServiceManual = !!(service_address && String(service_address).trim());
      const hasServiceGeo = Number.isFinite(service_latitude) && Number.isFinite(service_longitude);
      if (!hasServiceManual && !hasServiceGeo) {
        service_address = hasManual ? address : null;
        service_latitude = hasGeo ? latitude : null;
        service_longitude = hasGeo ? longitude : null;
      }
    }

    const booking = await createDraftBooking({
      userId,
      body: {
        service_type,
        charger_type,
        address,
        latitude: hasGeo ? latitude : null,
        longitude: hasGeo ? longitude : null,
        service_address,
        service_latitude: Number.isFinite(service_latitude) ? service_latitude : null,
        service_longitude: Number.isFinite(service_longitude) ? service_longitude : null,
        service_location_name,
        ev_account_card_on_file
      },
      transaction: t
    });

    const { booking_code } = await generateBookingCode({ serviceType: service_type, now: new Date(), transaction: t });
    await booking.update({ booking_code }, { transaction: t });

    await t.commit();
    return { booking_id: booking.id, booking_code };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function updateBookingLocation(req, { bookingId, userId, body }) {
  const t = await db.sequelize.transaction();
  try {
    const booking = await getBookingOrThrow({ bookingId, userId, transaction: t, lock: t.LOCK.UPDATE });
    assertEditableStatus(booking.status);

    const address = body.address === null ? null : String(body.address || '').trim() || null;
    const latitude =
      body.latitude === undefined || body.latitude === null || body.latitude === ''
        ? null
        : Number(body.latitude);
    const longitude =
      body.longitude === undefined || body.longitude === null || body.longitude === ''
        ? null
        : Number(body.longitude);

    const hasManual = !!address;
    const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (!hasManual && !hasGeo) {
      throw new HttpError(400, 'Either address or (latitude, longitude) is required');
    }

    const hasServiceAddressInput = body.service_address !== undefined;
    const service_address = !hasServiceAddressInput
      ? undefined
      : body.service_address === null
        ? null
        : String(body.service_address || '').trim() || null;

    const hasServiceLatInput = body.service_latitude !== undefined;
    const hasServiceLngInput = body.service_longitude !== undefined;
    const service_latitude = !hasServiceLatInput
      ? undefined
      : body.service_latitude === null || body.service_latitude === ''
        ? null
        : Number(body.service_latitude);
    const service_longitude = !hasServiceLngInput
      ? undefined
      : body.service_longitude === null || body.service_longitude === ''
        ? null
        : Number(body.service_longitude);

    if (hasServiceLatInput || hasServiceLngInput) {
      if (!hasServiceLatInput || !hasServiceLngInput) {
        throw new HttpError(400, 'Either both service_latitude and service_longitude are required');
      }
      if (
        service_latitude !== null &&
        service_longitude !== null &&
        (!Number.isFinite(service_latitude) || !Number.isFinite(service_longitude))
      ) {
        throw new HttpError(400, 'Invalid service_latitude/service_longitude');
      }
    }

    const hasEvAddressInput = body.ev_charging_address !== undefined;
    const ev_charging_address = !hasEvAddressInput
      ? undefined
      : body.ev_charging_address === null
        ? null
        : String(body.ev_charging_address || '').trim() || null;

    const hasChargingLatInput = body.charging_latitude !== undefined;
    const hasChargingLngInput = body.charging_longitude !== undefined;
    const charging_latitude = !hasChargingLatInput
      ? undefined
      : body.charging_latitude === null || body.charging_latitude === ''
        ? null
        : Number(body.charging_latitude);
    const charging_longitude = !hasChargingLngInput
      ? undefined
      : body.charging_longitude === null || body.charging_longitude === ''
        ? null
        : Number(body.charging_longitude);

    if (hasChargingLatInput || hasChargingLngInput) {
      if (!hasChargingLatInput || !hasChargingLngInput) {
        throw new HttpError(400, 'Either both charging_latitude and charging_longitude are required');
      }
      if (charging_latitude !== null && charging_longitude !== null) {
        if (!Number.isFinite(charging_latitude) || !Number.isFinite(charging_longitude)) {
          throw new HttpError(400, 'Invalid charging_latitude/charging_longitude');
        }
      }
    }

    const service_location_name =
      body.service_location_name === undefined
        ? undefined
        : body.service_location_name === null
          ? null
          : String(body.service_location_name || '').trim() || null;
    const ev_charging_location_name =
      body.ev_charging_location_name === undefined
        ? undefined
        : body.ev_charging_location_name === null
          ? null
          : String(body.ev_charging_location_name || '').trim() || null;

    const updates = {
      address: hasManual ? address : null,
      latitude: hasGeo ? latitude : null,
      longitude: hasGeo ? longitude : null,
    };
    const ev_account_card_on_file = parseOptionalEvAccountCardOnFile(body.ev_account_card_on_file);
    if (ev_account_card_on_file !== undefined) {
      updates.ev_account_card_on_file = ev_account_card_on_file;
    }

    if (hasServiceAddressInput) updates.service_address = service_address;
    if (service_location_name !== undefined) updates.service_location_name = service_location_name;
    if (hasServiceLatInput && hasServiceLngInput) {
      updates.service_latitude = service_latitude;
      updates.service_longitude = service_longitude;
    }

    const serviceType = booking.service_type;

    if (body.charger_type !== undefined && serviceType === 'ev_charging') {
      const normalizedChargerType = normalizeEvChargerTypeInput(body.charger_type);
      if (!normalizedChargerType) {
        throw new HttpError(400, 'charger_type is invalid');
      }
      updates.charger_type = normalizedChargerType;
    }

    if (serviceType === 'ev_charging' || serviceType === 'combo') {
      if (hasEvAddressInput) updates.ev_charging_address = ev_charging_address;
      if (ev_charging_location_name !== undefined) {
        updates.ev_charging_location_name = ev_charging_location_name;
      }
      if (hasChargingLatInput && hasChargingLngInput) {
        updates.charging_latitude = charging_latitude;
        updates.charging_longitude = charging_longitude;
      }

      const isCombo = serviceType === 'combo';
      if (!isCombo) {
        if (updates.service_address === undefined && hasEvAddressInput) {
          updates.service_address = ev_charging_address;
        }
        if (updates.service_location_name === undefined && ev_charging_location_name) {
          updates.service_location_name = ev_charging_location_name;
        }
        if (
          updates.service_latitude === undefined &&
          updates.service_longitude === undefined &&
          hasChargingLatInput &&
          hasChargingLngInput
        ) {
          updates.service_latitude = charging_latitude;
          updates.service_longitude = charging_longitude;
        }

        if (!hasEvAddressInput && updates.service_address !== undefined) {
          updates.ev_charging_address = updates.service_address;
        }
        if (
          !hasEvAddressInput &&
          ev_charging_location_name === undefined &&
          updates.service_location_name !== undefined
        ) {
          updates.ev_charging_location_name = updates.service_location_name;
        }
        if (
          (!hasChargingLatInput || !hasChargingLngInput) &&
          updates.service_latitude !== undefined &&
          updates.service_longitude !== undefined
        ) {
          updates.charging_latitude = updates.service_latitude;
          updates.charging_longitude = updates.service_longitude;
        }
      }
    }

    await updateBooking({
      bookingId,
      userId,
      updates,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    await t.commit();
    return { booking_id: booking.id };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function updateServiceDetails({ bookingId, userId, body }) {
  const t = await db.sequelize.transaction();
  try {
    const booking = await getBookingOrThrow({ bookingId, userId, transaction: t, lock: t.LOCK.UPDATE });
    assertEditableStatus(booking.status);
    assertStep1Complete(booking);

    const serviceType = booking.service_type;
    const ev_account_card_on_file = parseOptionalEvAccountCardOnFile(body.ev_account_card_on_file);

    const package_id = body.package_id === null ? null : Number.parseInt(String(body.package_id || ''), 10) || null;
    const custom_package_name = body.custom_package_name === null ? null : String(body.custom_package_name || '').trim() || null;
    const custom_price =
      body.custom_price === null || body.custom_price === undefined || body.custom_price === ''
        ? null
        : Number(body.custom_price);

    const scheduled_at = body.scheduled_at ? new Date(body.scheduled_at) : null;
    const schedule_type = normalizeCustomerScheduleType(body.schedule_type, scheduled_at);
    if (!CUSTOMER_SCHEDULE_TYPES.has(schedule_type)) {
      throw new HttpError(400, 'schedule_type must be asap or scheduled');
    }
    if (schedule_type === 'scheduled' && (!scheduled_at || Number.isNaN(scheduled_at.getTime()))) {
      throw new HttpError(400, 'scheduled_at is required');
    }

    const hasPackage = !!package_id;
    const hasCustom = !!(custom_package_name && custom_price !== null);

    const hasPackageOrCustom = hasPackage || hasCustom;
    const requiresPackage = serviceType === 'car_wash' || serviceType === 'combo';
    if (requiresPackage && !hasPackageOrCustom) {
      throw new HttpError(400, 'Either package_id or (custom_package_name + custom_price) is required');
    }

    // If client sends both, validator should reject; keep this as a defensive guard.
    if (hasPackage && (custom_package_name || custom_price !== null)) throw new HttpError(400, 'Provide either package_id or custom_package fields, not both');

    const hasServiceManualExisting = !!(booking.service_address && String(booking.service_address).trim());
    const hasServiceGeoExisting =
      booking.service_latitude !== null &&
      booking.service_latitude !== undefined &&
      booking.service_longitude !== null &&
      booking.service_longitude !== undefined;
    const hasServiceLocationExisting = hasServiceManualExisting || hasServiceGeoExisting;

    const hasServiceAddressInput = body.service_address !== undefined;
    const service_address = !hasServiceAddressInput
      ? undefined
      : body.service_address === null
        ? null
        : String(body.service_address || '').trim() || null;

    const hasServiceLatInput = body.service_latitude !== undefined;
    const hasServiceLngInput = body.service_longitude !== undefined;
    const service_latitude = !hasServiceLatInput
      ? undefined
      : body.service_latitude === null || body.service_latitude === '' ? null : Number(body.service_latitude);
    const service_longitude = !hasServiceLngInput
      ? undefined
      : body.service_longitude === null || body.service_longitude === '' ? null : Number(body.service_longitude);

    const hasEvAddressInput = body.ev_charging_address !== undefined;
    const ev_charging_address = !hasEvAddressInput
      ? undefined
      : body.ev_charging_address === null
        ? null
        : String(body.ev_charging_address || '').trim() || null;

    const hasChargingLatInput = body.charging_latitude !== undefined;
    const hasChargingLngInput = body.charging_longitude !== undefined;
    const charging_latitude = !hasChargingLatInput
      ? undefined
      : body.charging_latitude === null || body.charging_latitude === '' ? null : Number(body.charging_latitude);
    const charging_longitude = !hasChargingLngInput
      ? undefined
      : body.charging_longitude === null || body.charging_longitude === '' ? null : Number(body.charging_longitude);

    const service_location_name =
      body.service_location_name === undefined
        ? undefined
        : body.service_location_name === null
          ? null
          : String(body.service_location_name || '').trim() || null;
    const ev_charging_location_name =
      body.ev_charging_location_name === undefined
        ? undefined
        : body.ev_charging_location_name === null
          ? null
          : String(body.ev_charging_location_name || '').trim() || null;

    if (hasServiceLatInput || hasServiceLngInput) {
      if (!hasServiceLatInput || !hasServiceLngInput) throw new HttpError(400, 'Either both service_latitude and service_longitude are required');
      if (!Number.isFinite(service_latitude) || !Number.isFinite(service_longitude)) throw new HttpError(400, 'Invalid service_latitude/service_longitude');
    }

    if (hasChargingLatInput || hasChargingLngInput) {
      if (!hasChargingLatInput || !hasChargingLngInput) throw new HttpError(400, 'Either both charging_latitude and charging_longitude are required');
      // Allow nulls (client can send null to clear).
      if (charging_latitude !== null && charging_longitude !== null) {
        if (!Number.isFinite(charging_latitude) || !Number.isFinite(charging_longitude)) {
          throw new HttpError(400, 'Invalid charging_latitude/charging_longitude');
        }
      }
    }

    const incomingHasEvManual =
      hasEvAddressInput && ev_charging_address !== null && ev_charging_address !== undefined && String(ev_charging_address).trim();
    const incomingHasChargingGeo = Number.isFinite(charging_latitude) && Number.isFinite(charging_longitude);

    const incomingHasServiceLocation =
      (service_address !== undefined && service_address !== null) ||
      (hasServiceLatInput && hasServiceLngInput && Number.isFinite(service_latitude) && Number.isFinite(service_longitude)) ||
      incomingHasEvManual ||
      incomingHasChargingGeo;

    const requiresServiceLocation = serviceType === 'ev_charging' || serviceType === 'combo';
    if (requiresServiceLocation && !hasServiceLocationExisting && !incomingHasServiceLocation) {
      throw new HttpError(400, 'Service location details missing');
    }

    if (package_id) {
      const pkg = await db.Package.findByPk(package_id, {
        include: [{ model: db.Service, as: 'service', attributes: ['name'] }],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!pkg) throw new HttpError(400, 'Invalid package_id');
      if (!packageAllowedForBookingServiceType(pkg.service?.name, booking.service_type)) {
        throw new HttpError(400, 'package_id does not belong to service_type');
      }
    }

    const updates = {
      package_id: package_id || null,
      custom_package_name,
      custom_price,
      schedule_type,
      scheduled_at: schedule_type === 'scheduled' ? scheduled_at : null
    };
    if (ev_account_card_on_file !== undefined) {
      updates.ev_account_card_on_file = ev_account_card_on_file;
    }

    if (body.charger_type !== undefined && serviceType === 'ev_charging') {
      const normalizedChargerType = normalizeEvChargerTypeInput(body.charger_type);
      if (!normalizedChargerType) {
        throw new HttpError(400, 'charger_type is invalid');
      }
      updates.charger_type = normalizedChargerType;
    }

    if (service_address !== undefined) {
      updates.service_address = service_address;
    }
    if (service_location_name !== undefined) {
      updates.service_location_name = service_location_name;
    }
    if (hasServiceLatInput && hasServiceLngInput) {
      updates.service_latitude = service_latitude;
      updates.service_longitude = service_longitude;
    }

    if (requiresServiceLocation) {
      if (hasEvAddressInput) updates.ev_charging_address = ev_charging_address;
      if (ev_charging_location_name !== undefined) {
        updates.ev_charging_location_name = ev_charging_location_name;
      }
      if (hasChargingLatInput && hasChargingLngInput) {
        updates.charging_latitude = charging_latitude;
        updates.charging_longitude = charging_longitude;
      }

      const isCombo = serviceType === 'combo';

      // EV-only: mirror EV ↔ service_* when one side is missing.
      // Combo: wash (service_*) and charging (ev_*) are separate stops; driver visits charge first.
      if (!isCombo) {
        if (updates.service_address === undefined && hasEvAddressInput) {
          updates.service_address = ev_charging_address;
        }
        if (updates.service_location_name === undefined && ev_charging_location_name) {
          updates.service_location_name = ev_charging_location_name;
        }
        if (updates.service_latitude === undefined && updates.service_longitude === undefined && hasChargingLatInput && hasChargingLngInput) {
          updates.service_latitude = charging_latitude;
          updates.service_longitude = charging_longitude;
        }

        if (!hasEvAddressInput && updates.service_address !== undefined) {
          updates.ev_charging_address = updates.service_address;
        }
        if (
          !hasEvAddressInput &&
          ev_charging_location_name === undefined &&
          updates.service_location_name !== undefined
        ) {
          updates.ev_charging_location_name = updates.service_location_name;
        }
        if ((!hasChargingLatInput || !hasChargingLngInput) && updates.service_latitude !== undefined && updates.service_longitude !== undefined) {
          updates.charging_latitude = updates.service_latitude;
          updates.charging_longitude = updates.service_longitude;
        }
      }
    }

    await updateBooking({
      bookingId,
      userId,
      updates,
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    await t.commit();
    return { booking_id: booking.id };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function updateVehicleDetails(req, { bookingId, userId, body, files }) {
  const t = await db.sequelize.transaction();
  try {
    const booking = await getBookingOrThrow({ bookingId, userId, transaction: t, lock: t.LOCK.UPDATE });
    assertEditableStatus(booking.status);
    assertStep1Complete(booking);
    assertStep2Complete(booking);

    const vehicle_id = Number.parseInt(String(body.vehicle_id), 10);
    if (!vehicle_id || vehicle_id < 1) throw new HttpError(400, 'vehicle_id is required');

    const rawLimit = body.vehicle_charge_limit;
    const hasLimit = !(rawLimit === undefined || rawLimit === null || rawLimit === '');
    const vehicle_charge_limit = hasLimit ? Number.parseInt(String(rawLimit), 10) : null;
    const needsLimit = booking.service_type === 'ev_charging' || booking.service_type === 'combo';
    if (needsLimit) {
      if (!isValidVehicleChargeLimitPercent(vehicle_charge_limit)) {
        throw new HttpError(400, 'vehicle_charge_limit is required (50–100 in steps of 5)');
      }
    } else if (hasLimit) {
      throw new HttpError(400, 'vehicle_charge_limit is only allowed for ev_charging or combo');
    }

    const vehicle = await db.Vehicle.findOne({
      where: {
        id: vehicle_id,
        user_id: userId,
        status: { [Op.ne]: 'removed' }
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!vehicle) throw new HttpError(400, 'Invalid vehicle_id');

    const isElectric = vehicle.fuel_type === 'ELECTRIC';
    const needsEvBattery =
      booking.service_type === 'ev_charging' || booking.service_type === 'combo';

    let current_battery_charge = null;
    let current_battery_status = null;
    let rate_per_kw = null;

    if (needsEvBattery) {
      const hasBatteryInput =
        (body.current_battery_status !== undefined &&
          body.current_battery_status !== null &&
          String(body.current_battery_status).trim()) ||
        (body.current_battery_charge !== undefined &&
          body.current_battery_charge !== null &&
          body.current_battery_charge !== '');

      if (!hasBatteryInput) {
        throw new HttpError(400, 'current_battery_status is required for EV charging bookings');
      }

      const batteryFields = resolveBatteryFieldsFromBody(body);
      current_battery_status = batteryFields.current_battery_status;
      current_battery_charge = batteryFields.current_battery_charge;
    }

    if (isElectric && needsEvBattery) {
      const rawRate = body.rate_per_kw;
      if (rawRate !== undefined && rawRate !== null && rawRate !== '') {
        rate_per_kw = parseFloat(rawRate);
        if (!Number.isFinite(rate_per_kw) || rate_per_kw < 0) {
          throw new HttpError(400, 'rate_per_kw must be a non-negative number');
        }
      }
    }

    const serviceNotesRaw =
      body.service_notes !== undefined && body.service_notes !== null
        ? body.service_notes
        : body.notes;
    const notes = serviceNotesRaw ? String(serviceNotesRaw).trim() || null : null;
    const ev_account_card_on_file = parseOptionalEvAccountCardOnFile(body.ev_account_card_on_file);

    let structuredNotes;
    try {
      structuredNotes = parseServiceNotesBody(body);
      assertServiceNotesComplete(structuredNotes);
    } catch (err) {
      throw new HttpError(400, err?.message || 'Invalid service notes');
    }

    const parkingSummary = formatServiceNotesSummary(structuredNotes);

    await updateBooking({
      bookingId,
      userId,
      updates: {
        vehicle_id: vehicle.id,
        vehicle_charge_limit,
        current_battery_charge,
        current_battery_status,
        rate_per_kw,
        ...structuredNotes,
        parking_instructions: parkingSummary,
        notes,
        ...(ev_account_card_on_file === undefined ? {} : { ev_account_card_on_file })
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const uploadFiles = Array.isArray(files) ? files : [];
    if (uploadFiles.length) {
      // Store under uploads/<bookingId>/images
      const bookingFolder = booking.booking_code ? String(booking.booking_code) : `booking-${booking.id}`;
      const uploadDir = `bookings/${bookingFolder}`;

      for (const file of uploadFiles) {
        const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
        const saved = await saveWebpFile({
          buffer: webp,
          uploadDir,
          req,
          fileBaseName: file.originalname || 'booking'
        });
        await db.BookingImage.create(
          { booking_id: booking.id, image_url: saved.publicPath, image_type: BOOKING_IMAGE_TYPES.CUSTOMER },
          { transaction: t }
        );
      }
    }

    await t.commit();
    return {
      booking_id: booking.id,
      vehicle_id: vehicle.id,
      vehicle_charge_limit,
      current_battery_status,
      current_battery_charge,
      rate_per_kw,
      ...buildServiceNotesResponse({
        ...structuredNotes,
        parking_instructions: parkingSummary,
        notes
      }),
      booking_images: uploadFiles.length,
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function uploadBookingImages(req, { bookingId, userId, files }) {
  if (!Array.isArray(files) || files.length === 0) throw new HttpError(400, 'No images uploaded');

  const t = await db.sequelize.transaction();
  try {
    const booking = await getBookingOrThrow({ bookingId, userId, transaction: t, lock: t.LOCK.UPDATE });
    assertEditableStatus(booking.status);

    // Store under uploads/<bookingId>/images
    const bookingFolder = booking.booking_code ? String(booking.booking_code) : `booking-${booking.id}`;
    const uploadDir = `${bookingFolder}/images`;
    const created = [];

    for (const file of files) {
      const webp = await bufferToWebp(file.buffer, { maxWidth: 1920, quality: 80 });
      const saved = await saveWebpFile({
        buffer: webp,
        uploadDir,
        req,
        fileBaseName: file.originalname || 'booking'
      });
      const row = await db.BookingImage.create(
        { booking_id: booking.id, image_url: saved.publicPath, image_type: BOOKING_IMAGE_TYPES.CUSTOMER },
        { transaction: t }
      );
      const plain = row.get({ plain: true });
      created.push({ ...plain, image_url: ensureAbsoluteUrl(req, plain.image_url) });
    }

    await t.commit();
    return created;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function getBookingReview(req, { bookingId, userId }) {
  const b = await getReviewBundle({ bookingId, userId });
  assertStep1Complete(b);
  assertStep2Complete(b);
  assertStep3Complete(b);

  let evCharging = null;
  const isEvService = b.service_type === 'ev_charging' || b.service_type === 'combo';

  if (isEvService && b.vehicle && b.current_battery_charge != null && b.rate_per_kw != null) {
    evCharging = calcEvChargingCost({
      batteryCapacityKwh: b.vehicle.battery_capacity_kwh,
      vehicleChargeLimit: b.vehicle_charge_limit,
      currentBatteryCharge: b.current_battery_charge,
      ratePerKw: b.rate_per_kw
    });
  }

  const effectiveScheduleType = resolveEffectiveScheduleType(
    b.schedule_type,
    b.scheduled_at || b.service_datetime
  );

  const evPackageRow =
    b.service_type === 'ev_charging' || b.service_type === 'combo'
      ? await resolveEvChargingPackageRow({ packageRow: b.package })
      : null;
  const comboPackageRow =
    b.service_type === 'combo'
      ? await resolveComboServicePackageRow({ packageRow: b.package })
      : null;

  let pricing = await calcCustomerBookingPricing({
    booking: b,
    packageRow: b.package,
    evPackageRow,
    addons: b.addons,
    vehicle: b.vehicle,
    userId,
    excludeBookingId: b.id,
    scheduleType: effectiveScheduleType,
  });

  pricing = await applyProviderCompensationToPricing(pricing, {
    booking: b,
    packageRow: b.package,
    evPackageRow,
    comboPackageRow,
    scheduleType: effectiveScheduleType,
    serviceType: b.service_type,
  });

  const price_summary = await buildBookingPriceSummary({
    booking: b,
    packageRow: b.package,
    evPackageRow,
    comboPackageRow,
    addons: b.addons,
    vehicle: b.vehicle,
    pricing,
    scheduleType: effectiveScheduleType,
  });
  pricing = syncPricingTotalsFromPriceSummary(pricing, price_summary);

  return {
    booking_id: b.id,
    status: b.status,
    service_type: b.service_type,
    charger_type: b.charger_type || null,
    charger_type_label: b.charger_type
      ? EV_CHARGER_TYPES.find((item) => item.value === b.charger_type)?.label || null
      : null,
    location: {
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      service_location: {
        address: b.service_address,
        name: b.service_location_name,
        latitude: b.service_latitude,
        longitude: b.service_longitude
      },
      ev_charging: {
        address: b.ev_charging_address,
        name: b.ev_charging_location_name,
        latitude: b.charging_latitude,
        longitude: b.charging_longitude
      }
    },
    service_details: {
      package_id: b.package_id,
      package: b.package || null,
      custom_package_name: b.custom_package_name,
      custom_price: b.custom_price,
      schedule_type: b.schedule_type,
      effective_schedule_type: effectiveScheduleType,
      on_demand_fee_applies: effectiveScheduleType === 'on_demand',
      scheduled_at: b.scheduled_at,
      addons: b.addons || []
    },
    vehicle: b.vehicle
      ? (() => {
          // Destructure to explicitly exclude `images` (VehicleImage profile photos)
          // from the review payload. These are stored vehicle photos from the
          // customer's vehicle registration and must NOT appear on the booking
          // review screen as if the customer uploaded them in this session.
          const { images: _vehicleImages, ...vehicleWithoutImages } = b.vehicle;
          return {
            ...vehicleWithoutImages,
            vehicle_charge_limit: b.vehicle_charge_limit,
            current_battery_status: b.current_battery_status,
            current_battery_status_label: getEvBatteryStatusLabel(b.current_battery_status),
            current_battery_charge: b.current_battery_charge,
            rate_per_kw: b.rate_per_kw,
          };
        })()
      : null,
    service_notes: buildServiceNotesResponse(b),
    ev_charging_details: evCharging,
    ev_charging_options: isEvService ? getEvChargingBookingOptions() : null,
    booking_images: (b.images || []).map((img) => ensureAbsoluteUrl(req, img.image_url)),
    vehicle_photos: (b.images || []).map((img) => ensureAbsoluteUrl(req, img.image_url)),
    pricing: {
      base_price: pricing.base_price,
      convenience_fee: pricing.convenience_fee,
      on_demand_fee: pricing.on_demand_fee,
      towing_fee: pricing.towing_fee,
      service_fee: pricing.service_fee,
      platform_fee: pricing.platform_fee,
      tax: pricing.tax,
      referral_discount_amount: pricing.referral_discount_amount,
      total_price: pricing.total_price,
    },
    price_summary,
  };
}

async function confirmBooking({ bookingId, userId, body }) {
  // payment_method_id is accepted but not processed here (integration surface).
  const payment_method_id = body?.payment_method_id ? String(body.payment_method_id) : null;
  if (!payment_method_id) throw new HttpError(400, 'payment_method_id is required');

  // Phase 1: short lock to validate and freeze pricing + mark pending_payment.
  const t1 = await db.sequelize.transaction();
  let booking;
  let pricing;
  let priceSummary;
  try {
    booking = await db.Booking.findOne({
      where: { id: bookingId, user_id: userId },
      include: [
        { model: db.Package, as: 'package' },
        { model: db.AddOn, as: 'addons', through: { attributes: [] } },
        { model: db.Vehicle, as: 'vehicle' }
      ],
      transaction: t1,
      lock: t1.LOCK.UPDATE
    });
    if (!booking) throw new HttpError(404, 'Booking not found');
    assertEditableStatus(booking.status);

    assertStep1Complete(booking);
    assertStep2Complete(booking);
    assertStep3Complete(booking);

    const effectiveScheduleType = resolveEffectiveScheduleType(
      booking.schedule_type,
      booking.scheduled_at || booking.service_datetime,
      new Date()
    );

    const evPackageRow =
      booking.service_type === 'ev_charging' || booking.service_type === 'combo'
        ? await resolveEvChargingPackageRow({ packageRow: booking.package })
        : null;
    const comboPackageRow =
      booking.service_type === 'combo'
        ? await resolveComboServicePackageRow({ packageRow: booking.package })
        : null;

    // For custom-package bookings (no package_id), load the default car-wash
    // package so its provider compensation rates can be used as a fallback.
    const isCustomPackage = !booking.package_id && !!booking.custom_package_name;
    const customFallbackPackageRow =
      isCustomPackage && booking.service_type === 'car_wash'
        ? await resolveCarWashPackageRow({ packageRow: null })
        : null;

    pricing = await calcCustomerBookingPricing({
      booking: booking.get({ plain: true }),
      packageRow: booking.package,
      evPackageRow,
      addons: booking.addons,
      vehicle: booking.vehicle,
      userId,
      excludeBookingId: booking.id,
      scheduleType: effectiveScheduleType,
      transaction: t1,
    });

    pricing = await applyProviderCompensationToPricing(pricing, {
      booking: booking.get({ plain: true }),
      packageRow: booking.package,
      evPackageRow,
      comboPackageRow,
      scheduleType: effectiveScheduleType,
      serviceType: booking.service_type,
    });

    priceSummary = await buildBookingPriceSummary({
      booking,
      packageRow: booking.package,
      evPackageRow,
      comboPackageRow,
      addons: booking.addons,
      vehicle: booking.vehicle,
      pricing,
      scheduleType: effectiveScheduleType,
    });
    pricing = syncPricingTotalsFromPriceSummary(pricing, priceSummary);

    const referralDiscountType = await resolveReferralDiscountTypeForBooking(userId, {
      transaction: t1,
      excludeBookingId: booking.id
    });

    const baseBeforeDiscount =
      pricing.base_price_before_discount != null
        ? Number(pricing.base_price_before_discount)
        : Number(pricing.referral_discount_amount || 0) > 0
          ? Number((Number(pricing.base_price) + Number(pricing.referral_discount_amount)).toFixed(2))
          : null;

    const {
      service_fee_percent,
      platform_fee_percent,
      tax_percent,
      subtotal_before_referral: _subtotal,
      ...pricingFields
    } = pricing;

    const providerComp =
      pricing.provider_compensation_amount != null
        ? {
            compensationType: pricing.provider_compensation_type,
            compensationValue: pricing.provider_compensation_value,
            amount: Number(pricing.provider_compensation_amount),
            onDemandCompensationType: pricing.on_demand_provider_compensation_type,
            onDemandCompensationValue: pricing.on_demand_provider_compensation_value,
            onDemandAmount: pricing.on_demand_provider_compensation_amount,
          }
        : booking.service_type === 'combo' && comboPackageRow
          ? (() => {
              const amount = resolveComboProviderCompensationAmount({
                booking: booking.get({ plain: true }),
                comboPackageRow,
                scheduleType: effectiveScheduleType,
                basePrice: comboPackageRow.base_price,
              });
              return {
                compensationType: comboPackageRow.provider_compensation_type,
                compensationValue: comboPackageRow.provider_compensation_value,
                amount,
                onDemandCompensationType: comboPackageRow.on_demand_provider_compensation_type,
                onDemandCompensationValue: comboPackageRow.on_demand_provider_compensation_value,
                onDemandAmount:
                  effectiveScheduleType === 'on_demand' || effectiveScheduleType === 'asap'
                    ? amount
                    : null,
              };
            })()
          : resolveProviderCompensationFromPackage({
              // For custom-package bookings booking.package is null;
              // fall back to the default car-wash package compensation rates.
              packageRow: booking.package ?? customFallbackPackageRow ?? null,
              scheduleType: effectiveScheduleType,
              basePrice: pricing.base_price,
            });

    // Resolve and snapshot service_duration_minutes from the package at confirm
    // time so all downstream screens (active booking, job board, invoice) read
    // the correct admin-configured value instead of falling back to hardcoded defaults.
    const bookingPlainForDuration = booking.get({ plain: true });
    const resolvedDurationMinutes = resolveServiceDurationMinutes(
      bookingPlainForDuration,
      booking.package ? booking.package.get({ plain: true }) : null,
      evPackageRow,
      comboPackageRow
    );

    await booking.update(
      {
        ...pricingFields,
        schedule_type: effectiveScheduleType,
        base_price_before_discount: baseBeforeDiscount,
        provider_compensation_type: providerComp.compensationType,
        provider_compensation_value: providerComp.compensationValue,
        provider_compensation_amount: providerComp.amount,
        on_demand_provider_compensation_type: providerComp.onDemandCompensationType,
        on_demand_provider_compensation_value: providerComp.onDemandCompensationValue,
        on_demand_provider_compensation_amount: providerComp.onDemandAmount,
        referral_discount_type: referralDiscountType,
        promotional_discount_id: pricing.promotional_discount_id ?? null,
        promotional_discount_name: pricing.promotional_discount_name ?? null,
        promotional_discount_amount: pricing.promotional_discount_amount ?? 0,
        price_summary: priceSummary,
        ...(resolvedDurationMinutes != null && resolvedDurationMinutes > 0
          ? { service_duration_minutes: resolvedDurationMinutes }
          : {}),
        status: 'pending_payment'
      },
      { transaction: t1 }
    );
    await t1.commit();
  } catch (e) {
    await t1.rollback();
    throw e;
  }

  // Phase 2: charge Stripe (no DB locks held).
  const txn = await createAndConfirmPaymentIntent({
    booking,
    userId,
    payment_method_id,
    amount: priceSummary.total,
    currency: 'usd'
  });

  // Phase 3: update booking status based on Stripe result.
  const isPaid = txn.status === 'succeeded';
  if (isPaid) {
    const bookingPatch = { status: 'confirmed' };
    const paidScheduleType = String(booking.schedule_type || '').trim().toLowerCase();
    if (paidScheduleType === 'scheduled') {
      bookingPatch.tracking_status = 'scheduled';
    }
    await db.Booking.update(bookingPatch, { where: { id: booking.id, user_id: userId } });

    const paidBooking = await db.Booking.findByPk(booking.id, {
      attributes: ['referral_discount_type']
    });
    if (paidBooking?.referral_discount_type) {
      await consumeReferralDiscount({ userId, discountType: paidBooking.referral_discount_type });
    }

    // Record promotional discount use
    const fullPaidBooking = await db.Booking.findByPk(booking.id, {
      attributes: ['promotional_discount_id']
    });
    if (fullPaidBooking?.promotional_discount_id) {
      await recordPromotionUse(fullPaidBooking.promotional_discount_id);
    }

    const paidBookingRow = await db.Booking.findByPk(booking.id);
    const confirmedPlain = paidBookingRow
      ? { ...paidBookingRow.get({ plain: true }), status: 'confirmed' }
      : { ...booking.get({ plain: true }), status: 'confirmed' };

    // Send confirmation email + SMS + push/inbox (best-effort, non-blocking).
    sendBookingConfirmedNotifications({ booking: confirmedPlain, userId }).catch((err) => {
      logger.error('sendBookingConfirmedNotifications failed', {
        bookingId: booking.id,
        message: err?.message,
      });
    });
    notifyCustomerBookingConfirmed({ booking: confirmedPlain, userId }).catch((err) => {
      logger.error('notifyCustomerBookingConfirmed failed', {
        bookingId: booking.id,
        message: err?.message,
      });
    });
    notifyAdminNewBooking({ booking: confirmedPlain }).catch((err) => {
      logger.error('notifyAdminNewBooking failed', {
        bookingId: booking.id,
        message: err?.message,
      });
    });

    // Scheduled service reminders (24h/12h/5h/2h/1h) are queued when a provider accepts — see bookingDecision.service.js.

    // BOOKING_CREATED: realtime + push to nearby drivers (no DB notification rows).
    notifyNearbyDriversBookingCreated(booking.id).catch((err) => {
      logger.error('notifyNearbyDriversBookingCreated failed', { bookingId: booking.id, message: err?.message });
    });
  }

  const bookingCodeDisplay = booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
  const serviceTypeLabel = getServiceTypeLabel(booking.service_type);
  const currency = txn.currency || 'usd';

  return {
    booking_id: booking.id,
    booking_code: booking.booking_code,
    booking_id_display: bookingCodeDisplay,
    status: txn.status === 'succeeded' ? 'confirmed' : 'pending_payment',
    price_summary: priceSummary,
    service_type: booking.service_type,
    service_type_label: serviceTypeLabel,
    currency,
    transaction: {
      id: txn.id,
      transaction_code: txn.transaction_code,
      status: txn.status,
      stripe_payment_intent_id: txn.stripe_payment_intent_id,
      amount: txn.amount,
      currency: txn.currency
    },
    // Frontends can use this payload to show a confirmation screen.
    confirmation: isPaid
      ? {
          title: 'Booking Confirmed!',
          subtitle: "We've sent you a confirmation email and text message.",
          notification_message:
            'You will be notified once a service provider in your area has accepted the booking or when the job is assigned.',
          service_type_label: serviceTypeLabel,
          booking_id_display: bookingCodeDisplay,
          actions: {
            primary: { label: 'Home', action: 'navigate', path: '/' },
            secondary: {
              label: 'View Booking Details',
              action: 'navigate',
              // Client can override routing; this is just a sensible default.
              path: `/bookings/${booking.id}`
            }
          }
        }
      : {
          title: 'Payment Pending',
          subtitle: 'Your payment is still processing.',
          notification_message: 'Please check back shortly for confirmation.'
        }
  };
}

function getEvChargingOptions() {
  return getEvChargingBookingOptions();
}

module.exports = {
  startBooking,
  updateBookingLocation,
  updateServiceDetails,
  updateVehicleDetails,
  uploadBookingImages,
  getBookingReview,
  confirmBooking,
  getEvChargingOptions,
};
