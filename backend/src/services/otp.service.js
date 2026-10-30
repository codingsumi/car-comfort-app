const { sendEmail, sendVerificationEmail } = require('./email.service');
const { generateEmailTemplate } = require('../../utils/emailTemplate');
const { sendSms } = require('./sms.service');

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function generateAndSendEmailOtp(user, { purpose = 'verify' } = {}) {
  const otp = generateOtp(6);
  const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  const otpExpiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

  await user.update({ otp_code: otp, otp_expiry: otpExpiry });

  const subject = purpose === 'reset' ? 'Reset your password' : 'Verify your sign-up';
  const title = purpose === 'reset' ? 'Reset your password' : 'Verify your sign-up';
  const message =
    purpose === 'reset'
      ? 'We received a request to reset your password. Enter the code below where you started the password reset.'
      : 'Enter the verification code below to complete your sign-up.';
  const footer = `If you did not request this, please disregard this email. The code will remain active for ${otpExpiryMinutes} minutes.`;

  const html = generateEmailTemplate({
    title,
    message,
    code: otp,
    footer,
    preheader: `Your code is ${otp}. Expires in ${otpExpiryMinutes} minutes.`
  });
  const text = `Your OTP is ${otp}. ${purpose === 'reset' ? 'Use it to reset your password.' : 'Use it to verify your account.'
    } It expires in ${otpExpiryMinutes} minutes.`;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
}

async function generateAndSendVerificationOtp(user) {
  const otp = generateOtp(6);
  const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  const otpExpiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

  await user.update({ otp_code: otp, otp_expiry: otpExpiry });

  await sendVerificationEmail(user.email, otp);

  const text = `Your OTP is ${otp}. Use it to verify your account. It expires in ${otpExpiryMinutes} minutes.`;

  if (user.phone) {
    await sendSms({ to: user.phone, text });
  }

  return {
    channels: {
      email: Boolean(user.email),
      phone: Boolean(user.phone)
    }
  };
}

module.exports = { generateAndSendEmailOtp, generateAndSendVerificationOtp };

