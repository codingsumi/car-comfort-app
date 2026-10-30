const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');
const { generateEmailTemplate } = require('../../utils/emailTemplate');

function isEmailConfigured() {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD);
}

async function sendEmail({ to, subject, text, html, attachments }) {
  if (!isEmailConfigured()) {
    logger.info('mock_email', {
      to,
      subject,
      hasHtml: Boolean(html),
      attachmentCount: attachments?.length ?? 0,
    });
    return { mocked: true };
  }

  const port = Number(process.env.MAIL_PORT || 2525);
  const secure = port === 465; // true for 465, false for other ports (STARTTLS via requireTLS below)
  const enableDebug = String(process.env.MAIL_DEBUG || '').toLowerCase() === 'true';

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    },
    // Prevent SMTP hangs from blocking API responses.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    ...(process.env.MAIL_ENCRYPTION === 'tls' ? { requireTLS: true } : {}),
    ...(enableDebug ? { logger: true, debug: true } : {})
  });

  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'no-reply@example.com';
  const fromName = process.env.MAIL_FROM_NAME || 'Car Comfort';
  const from = `${fromName} <${fromAddress}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    ...(attachments?.length ? { attachments } : {})
  });

  logger.info('Email send result', {
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  });

  return {
    mocked: false,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  };
}

/**
 * Sign-up / email verification OTP using the unified HTML template.
 * @param {string} email
 * @param {string} code
 */
async function sendVerificationEmail(email, code) {
  const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  const html = generateEmailTemplate({
    title: 'Verify your sign-up',
    message:
      'Enter the verification code below to complete your sign-up.',
    code: String(code),
    footer: `If you did not attempt to sign up but received this email, please disregard it. The code will remain active for ${otpExpiryMinutes} minutes.`,
    preheader: `Your verification code is ${code}. It expires in ${otpExpiryMinutes} minutes.`
  });
  const text = [
    'Verify your sign-up',
    '',
    `Your verification code is: ${code}`,
    '',
    `If you did not attempt to sign up, please disregard this email. The code will remain active for ${otpExpiryMinutes} minutes.`
  ].join('\n');

  return sendEmail({
    to: email,
    subject: 'Verify your sign-up',
    text,
    html
  });
}

async function sendPasswordResetEmail(email, resetLink) {
  const html = generateEmailTemplate({
    title: 'Reset your password',
    message: 'We received a request to reset your admin account password. Click the button below to set a new password.',
    buttonText: 'Reset Password',
    buttonLink: resetLink,
    footer: `This link expires in 15 minutes. If you did not request a password reset, please ignore this email.`,
    preheader: 'Reset your Car Comfort admin password'
  });
  const text = [
    'Reset your password',
    '',
    'We received a request to reset your admin account password.',
    '',
    `Reset link: ${resetLink}`,
    '',
    'This link expires in 15 minutes. If you did not request this, ignore this email.'
  ].join('\n');

  return sendEmail({
    to: email,
    subject: 'Reset your admin password',
    text,
    html
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };

