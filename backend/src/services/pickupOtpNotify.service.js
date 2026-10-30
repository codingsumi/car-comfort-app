'use strict';

const db = require('../models');
const { logger } = require('../config/logger');
const { sendEmail } = require('./email.service');
const { sendSms } = require('./sms.service');
const { generateEmailTemplate } = require('../../utils/emailTemplate');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

function buildPickupOtpMessage(otp) {
  return `Your Car Comfort vehicle pickup PIN is ${otp}. Share this 4-digit code with your service provider when they arrive. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
}

/**
 * Deliver vehicle pickup OTP to the customer via email and SMS (in addition to push/socket).
 */
async function notifyCustomerPickupOtp({ customerId, bookingId, otp }) {
  const uid = Number(customerId);
  const code = String(otp || '').trim();
  if (!uid || code.length < 4) return { email: false, sms: false };

  const user = await db.User.findByPk(uid, {
    attributes: ['id', 'email', 'phone', 'name'],
  });
  if (!user) {
    logger.warn('pickup_otp_notify_user_missing', { customerId: uid, bookingId });
    return { email: false, sms: false };
  }

  const text = buildPickupOtpMessage(code);
  const result = { email: false, sms: false };

  const email = String(user.email || '').trim();
  if (email) {
    try {
      const html = generateEmailTemplate({
        title: 'Vehicle Pickup PIN',
        message:
          'Your service provider has arrived. Share this 4-digit PIN with them to start your service.',
        code,
        footer: `This PIN expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        preheader: `Your pickup PIN is ${code}`,
      });
      await sendEmail({
        to: email,
        subject: 'Vehicle Pickup PIN — Car Comfort',
        text,
        html,
      });
      result.email = true;
    } catch (err) {
      logger.error('pickup_otp_email_failed', {
        bookingId,
        customerId: uid,
        message: err?.message,
      });
    }
  }

  const phone = String(user.phone || '').trim();
  if (phone) {
    try {
      await sendSms({ to: phone, text });
      result.sms = true;
    } catch (err) {
      logger.error('pickup_otp_sms_failed', {
        bookingId,
        customerId: uid,
        message: err?.message,
      });
    }
  }

  logger.info('pickup_otp_channels_sent', {
    bookingId,
    customerId: uid,
    email: result.email,
    sms: result.sms,
  });

  return result;
}

module.exports = { notifyCustomerPickupOtp, buildPickupOtpMessage };
