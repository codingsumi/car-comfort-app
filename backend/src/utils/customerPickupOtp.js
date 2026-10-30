'use strict';

const crypto = require('crypto');

/** Tracking states where the customer may still need to share pickup OTP. */
const OTP_AWAITING_TRACKING = new Set(['OTP_PENDING', 'DRIVER_REACHED_CUSTOMER']);
const OTP_EXPIRY_MINUTES = 10;

/**
 * Active pickup OTP for the booking owner (customer), if still valid.
 */
function customerVehiclePickupOtpFromBooking(bookingPlain) {
  if (!bookingPlain) return null;
  const tracking = String(bookingPlain.tracking_status || '').trim().toUpperCase();
  if (!OTP_AWAITING_TRACKING.has(tracking)) return null;

  const otp =
    bookingPlain.pickup_otp != null ? String(bookingPlain.pickup_otp).trim() : '';
  if (!otp) return null;

  const expiry = bookingPlain.pickup_otp_expiry;
  if (expiry && new Date(expiry) < new Date()) return null;

  return otp;
}

function bookingPlain(booking) {
  if (!booking) return null;
  return typeof booking.get === 'function' ? booking.get({ plain: true }) : booking;
}

/**
 * Customer-facing pickup OTP for active/detail reads.
 * Regenerates when handover is in progress but OTP is missing or expired (e.g. app rejoin).
 */
async function resolveCustomerVehiclePickupOtp(booking) {
  const plain = bookingPlain(booking);
  if (!plain) return null;

  const existing = customerVehiclePickupOtpFromBooking(plain);
  if (existing) return existing;

  const tracking = String(plain.tracking_status || '').trim().toUpperCase();
  if (!OTP_AWAITING_TRACKING.has(tracking)) return null;
  if (typeof booking.update !== 'function') return null;

  const otp = String(crypto.randomInt(1000, 10000));
  await booking.update({
    pickup_otp: otp,
    pickup_otp_expiry: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  });
  return otp;
}

/** Never expose raw DB OTP columns in API payloads. */
function stripPickupOtpSecrets(bookingData) {
  if (!bookingData || typeof bookingData !== 'object') return bookingData;
  const { pickup_otp: _otp, pickup_otp_expiry: _expiry, ...rest } = bookingData;
  return rest;
}

module.exports = {
  customerVehiclePickupOtpFromBooking,
  resolveCustomerVehiclePickupOtp,
  stripPickupOtpSecrets
};
