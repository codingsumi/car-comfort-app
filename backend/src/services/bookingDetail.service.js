const { Op } = require('sequelize');

const db = require('../models');
const { logger } = require('../config/logger');
const { HttpError } = require('../utils/httpError');
const { formatBookingImagesForResponse } = require('../utils/bookingImages');
const { formatTipResponse, canCustomerTipOnBooking } = require('./bookingTip.service');
const { ensureAbsoluteUrl } = require('../utils/fileUpload');
const {
  getRatingSummariesByUserIds,
  getCustomerDriverReviewForBooking,
  canCustomerReviewDriver
} = require('./review.service');
const {
  resolveBookingDetailPriceSummary,
  resolveBookingChargedTotal,
  resolveComboServicePackageRow,
} = require('./bookingPriceSummary.service');
const { buildDriverEarningSummary } = require('../utils/bookingDriverEarning');
const {
  resolveCustomerVehiclePickupOtp,
  stripPickupOtpSecrets
} = require('../utils/customerPickupOtp');
const { buildServiceNotesResponse } = require('../constants/bookingServiceNotes');
const { getEvBatteryStatusLabel } = require('../constants/evChargingBooking');
const {
  buildDriverJobMapSummary,
  resolveEstimatedTravelMiles,
} = require('../utils/driverJobMapSummary');
const { generateBookingInvoicePdf } = require('./invoice.service');

const ROLES = new Set(['customer', 'driver', 'admin']);

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function countDriverCompletedBookings(driverUserId) {
  const uid = Number(driverUserId);
  if (!uid) return 0;
  return db.Booking.count({
    where: {
      assigned_driver_user_id: uid,
      status: 'completed'
    }
  });
}

function formatDriverAggregateRating(ratingSummary) {
  if (!ratingSummary || ratingSummary.avg_rating == null) return null;
  return Number(Number(ratingSummary.avg_rating).toFixed(1));
}

/** Customer booking detail: assigned provider with stats and review state. */
function buildAssignedDriverForCustomer(driverData, req) {
  if (!driverData) return null;
  const { id, name, phone, profilePicture, completedBookings, rating, reviewCount, review, canReview } = driverData;
  if (!id) return null;
  const profile_picture = profilePicture ? ensureAbsoluteUrl(req, profilePicture) : null;
  return {
    id,
    name: name || null,
    phone: phone != null && String(phone).trim() ? String(phone).trim() : null,
    profile_picture,
    experience: null,
    completed_bookings: Number(completedBookings) || 0,
    rating: rating ?? null,
    review_count: Number(reviewCount) || 0,
    review: review ?? null,
    can_review: Boolean(canReview)
  };
}

/** Booking owner / customer snapshot for detail responses. */
function buildCustomerBrief(userPlain, bookingPlain) {
  const rawId = userPlain?.id ?? bookingPlain?.user_id ?? bookingPlain?.customer_id ?? null;
  const id = rawId == null ? null : Number(rawId);
  if (!id || id < 1) return null;
  if (!userPlain) return { id, name: null, phone: null };

  const name =
    (userPlain.name && String(userPlain.name).trim()) ||
    [userPlain.first_name, userPlain.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const phone =
    userPlain.phone != null && String(userPlain.phone).trim() ? String(userPlain.phone).trim() : null;
  return {
    id,
    name,
    phone
  };
}

function normalizeHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

function resolvePublicBaseUrl() {
  const explicit = normalizeHttpUrl(process.env.INVOICE_PUBLIC_BASE_URL || process.env.INVOICE_QR_BASE_URL);
  if (explicit) return explicit;
  const publicBase = normalizeHttpUrl(process.env.PUBLIC_BASE_URL);
  if (publicBase) return publicBase;
  const website = normalizeHttpUrl(process.env.INVOICE_WEBSITE);
  return website;
}

function parseId(id) {
  const n = Number.parseInt(String(id), 10);
  if (!n || n < 1) throw new HttpError(400, 'id must be a positive integer');
  return n;
}

function buildWhereForRole({ id, auth }) {
  const role = String(auth?.role || '').trim();
  const userId = auth?.userId ? Number(auth.userId) : null;
  if (!ROLES.has(role) || !userId) throw new HttpError(401, 'Unauthorized');

  if (role === 'admin') return { id };
  if (role === 'customer') return { id, user_id: { [Op.eq]: userId } };
  if (role === 'driver') return { id, assigned_driver_user_id: { [Op.eq]: userId } };

  throw new HttpError(401, 'Unauthorized');
}

async function getBookingDetail({ id, auth, req }) {
  const bookingId = parseId(id);
  const where = buildWhereForRole({ id: bookingId, auth });

  const booking = await db.Booking.findOne({
    where,
    include: [
      {
        model: db.User,
        as: 'assigned_driver',
        required: false,
        attributes: ['id', 'name', 'phone'],
        include: [{ model: db.DriverProfile, as: 'driver_profile', required: false, attributes: ['profile_picture'] }]
      },
      {
        model: db.User,
        as: 'user',
        required: false,
        attributes: ['id', 'name', 'phone', 'first_name', 'last_name']
      },
      {
        model: db.Package,
        as: 'package',
        include: [{ model: db.Service, as: 'service', attributes: ['id', 'name', 'icon'] }]
      },
      { model: db.Vehicle, as: 'vehicle', include: [{ model: db.VehicleImage, as: 'images' }] },
      { model: db.AddOn, as: 'addons', through: { attributes: [] } },
      { model: db.BookingImage, as: 'images' }
    ],
    distinct: true
  });

  if (!booking) throw new HttpError(404, 'Booking not found');

  const txn = await db.BookingTransaction.findOne({
    where: { booking_id: bookingId, status: 'succeeded' },
    attributes: ['transaction_code', 'amount'],
    order: [['created_at', 'DESC']]
  });

  const baseUrl = resolvePublicBaseUrl();
  const invoiceUrl = txn?.transaction_code && baseUrl ? `${baseUrl}/invoices/${encodeURIComponent(txn.transaction_code)}` : null;

  const plain = booking.get({ plain: true });
  const role = String(auth?.role || '').trim();
  const driverProfilePicture = plain.assigned_driver?.driver_profile?.profile_picture || null;

  let assigned_driver = null;

  if (role === 'customer') {
    const driverId = plain.assigned_driver?.id || null;
    const customerUserId = auth?.userId ? Number(auth.userId) : null;

    const [completedBookings, ratingMap, driverReview] = await Promise.all([
      driverId ? countDriverCompletedBookings(driverId) : Promise.resolve(0),
      driverId ? getRatingSummariesByUserIds({ userIds: [driverId] }) : Promise.resolve(new Map()),
      customerUserId
        ? getCustomerDriverReviewForBooking({ bookingId, customerUserId, req })
        : Promise.resolve(null)
    ]);

    const ratingSummary = driverId ? ratingMap.get(Number(driverId)) : null;

    assigned_driver = buildAssignedDriverForCustomer(
      plain.assigned_driver
        ? {
            id: plain.assigned_driver.id,
            name: plain.assigned_driver.name,
            phone: plain.assigned_driver.phone,
            profilePicture: driverProfilePicture,
            completedBookings,
            rating: formatDriverAggregateRating(ratingSummary),
            reviewCount: ratingSummary?.review_count ?? 0,
            review: driverReview,
            canReview: canCustomerReviewDriver({
              status: plain.status,
              assignedDriverUserId: plain.assigned_driver_user_id,
              driverReview
            })
          }
        : null,
      req
    );
  } else if (plain.assigned_driver) {
    // Driver role: fetch the customer's review of this driver for this booking
    // so the driver can see their rating and feedback on their detail screen.
    let driverRoleReview = null;
    const customerUserId = plain.user_id || plain.customer_id || null;
    if (role === 'driver' && String(plain.status) === 'completed' && customerUserId) {
      try {
        driverRoleReview = await getCustomerDriverReviewForBooking({
          bookingId,
          customerUserId: Number(customerUserId),
          req,
        });
      } catch (_) {
        // non-fatal — just omit the review
      }
    }
    assigned_driver = {
      id: plain.assigned_driver.id,
      name: plain.assigned_driver.name,
      phone:
        plain.assigned_driver.phone != null && String(plain.assigned_driver.phone).trim()
          ? String(plain.assigned_driver.phone).trim()
          : null,
      profile_picture: driverProfilePicture ? ensureAbsoluteUrl(req, driverProfilePicture) : null,
      review: driverRoleReview ?? null,
    };
  }

  const customer = buildCustomerBrief(plain.user, plain);

  let tip = null;
  if (plain.status === 'completed') {
    const tipRow = await db.BookingTip.findOne({ where: { booking_id: bookingId } });
    tip = formatTipResponse(tipRow);
  }

  let customer_post_service = null;
  if (role === 'customer' && String(plain.status) === 'completed') {
    const hasReviewed = Boolean(assigned_driver?.review);
    const hasTipped = tip?.status === 'succeeded';
    const can_review = Boolean(assigned_driver?.can_review);
    const can_tip = canCustomerTipOnBooking({
      status: plain.status,
      assignedDriverUserId: plain.assigned_driver_user_id,
      tip,
    });
    customer_post_service = {
      can_review,
      can_tip,
      has_reviewed: hasReviewed,
      has_tipped: hasTipped,
    };
  }

  const { images: _images, assigned_driver: _rawDriver, user: _user, ...bookingDataRaw } = plain;
  const bookingData = stripPickupOtpSecrets(bookingDataRaw);
  const chargedTotal = resolveBookingChargedTotal(plain, { transactionAmount: txn?.amount });
  if (role !== 'driver' && chargedTotal != null) {
    bookingData.total_price = chargedTotal;
  }
  if (role === 'driver') {
    // Customer billing belongs to the customer/admin response only. Drivers
    // receive their payout via `driver_earning` below.
    delete bookingData.total_price;
    delete bookingData.total_price_display;
    delete bookingData.base_price;
    delete bookingData.custom_price;
  }
  const vehicle_pickup_otp =
    role === 'customer' ? await resolveCustomerVehiclePickupOtp(booking) : null;
  const { service_images } = formatBookingImagesForResponse(req, plain.images);

  let price_summary = null;
  if (role === 'customer' && toAmount(plain.total_price) > 0) {
    try {
      price_summary = await resolveBookingDetailPriceSummary(plain);
    } catch (err) {
      logger.warn('booking_detail_price_summary_failed', {
        bookingId,
        message: err?.message,
      });
    }
  }

  let driver_earning = null;
  if (role === 'driver') {
    let financeProviderEarning = null;
    if (String(plain.status) === 'completed') {
      const financeTxn = await db.Transaction.findOne({
        where: {
          booking_id: bookingId,
          transaction_type: 'booking_payment',
          status: 'succeeded',
        },
        attributes: ['provider_earning'],
        order: [['created_at', 'DESC']],
      });
      financeProviderEarning = financeTxn?.provider_earning;
    }

    const comboPackageRow =
      String(plain.service_type || '').trim() === 'combo'
        ? await resolveComboServicePackageRow({ packageRow: plain.package })
        : null;

    driver_earning = await buildDriverEarningSummary({
      booking: plain,
      tip,
      financeProviderEarning,
      comboPackageRow,
    });
  }

  const driver_detail = assigned_driver
    ? {
        id: assigned_driver.id,
        name: assigned_driver.name,
        phone: assigned_driver.phone,
        profile_picture: assigned_driver.profile_picture,
        avg_rating: assigned_driver.rating,
        review_count: assigned_driver.review_count,
        review: assigned_driver.review ?? null,
        can_review: Boolean(assigned_driver.can_review),
        can_tip: customer_post_service?.can_tip ?? false,
      }
    : null;

  const serviceNotes = buildServiceNotesResponse(plain);
  bookingData.vehicle_parked_location_label = serviceNotes.vehicle_parked_location_label;
  bookingData.provider_park_location_label = serviceNotes.provider_park_location_label;
  bookingData.vehicle_key_location_label = serviceNotes.vehicle_key_location_label;
  bookingData.key_return_location_label = serviceNotes.key_return_location_label;

  const comboPackageRowForTravel =
    String(plain.service_type || '').trim() === 'combo'
      ? await resolveComboServicePackageRow({ packageRow: plain.package })
      : null;
  const jobMapSummary = buildDriverJobMapSummary(
    plain,
    plain.package,
    null,
    comboPackageRowForTravel
  );
  if (jobMapSummary.service_duration_minutes != null) {
    bookingData.service_duration_minutes = jobMapSummary.service_duration_minutes;
  }
  if (jobMapSummary.package_name) {
    bookingData.package_name = jobMapSummary.package_name;
  }
  const batteryStatus = plain.current_battery_status;
  const batteryCharge = plain.current_battery_charge;
  if (batteryStatus != null && batteryStatus !== '') {
    bookingData.current_battery_status_label = getEvBatteryStatusLabel(batteryStatus);
  } else if (batteryCharge != null && batteryCharge !== '') {
    const chargeStr = String(batteryCharge).trim();
    bookingData.current_battery_status_label =
      getEvBatteryStatusLabel(chargeStr) ||
      (chargeStr.endsWith('%') ? chargeStr : `${chargeStr}%`);
  }
  bookingData.distance_miles = await resolveEstimatedTravelMiles(
    plain,
    plain.package,
    null,
    comboPackageRowForTravel
  );

  return {
    ...bookingData,
    vehicle_pickup_otp,
    service_images,
    assigned_driver,
    driver_detail,
    customer,
    invoice: role === 'driver' ? null : invoiceUrl,
    tip,
    customer_post_service,
    price_summary,
    driver_earning,
  };
}

async function downloadBookingInvoicePdf({ id, auth }) {
  const bookingId = parseId(id);
  const where = buildWhereForRole({ id: bookingId, auth });

  const booking = await db.Booking.findOne({
    where,
    include: [
      { model: db.Vehicle, as: 'vehicle' },
      {
        model: db.User,
        as: 'assigned_driver',
        attributes: ['id', 'first_name', 'last_name', 'name', 'email', 'phone'],
        required: false,
      },
    ],
  });
  if (!booking) throw new HttpError(404, 'Booking not found');

  const status = String(booking.status || '').trim().toLowerCase();
  if (status !== 'completed') {
    throw new HttpError(400, 'Invoice is available after the booking is completed');
  }

  const txn = await db.BookingTransaction.findOne({
    where: { booking_id: bookingId, status: 'succeeded' },
    order: [['created_at', 'DESC']],
  });
  if (!txn?.transaction_code) {
    throw new HttpError(404, 'Invoice not found for this booking');
  }

  const user = await db.User.findByPk(txn.user_id);
  if (!user) throw new HttpError(404, 'Invoice customer not found');

  const bookingPlain = booking.get({ plain: true });
  const token = String(txn.transaction_code).trim();
  const pdf = await generateBookingInvoicePdf({
    booking: bookingPlain,
    user: user.get({ plain: true }),
    vehicle: bookingPlain.vehicle || null,
    driver: bookingPlain.assigned_driver || null,
    token,
    invoiceId: txn.id,
  });

  const fileId = booking.booking_code ? String(booking.booking_code) : String(booking.id);
  return {
    buffer: pdf,
    filename: `invoice-${fileId}.pdf`,
  };
}

module.exports = { getBookingDetail, downloadBookingInvoicePdf };
