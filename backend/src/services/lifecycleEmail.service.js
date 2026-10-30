const db = require('../models');
const { sendEmail } = require('./email.service');
const { generateEmailTemplate } = require('../../utils/emailTemplate');
const { logger } = require('../config/logger');

function nowIso() {
  return new Date().toISOString();
}

function getEventStore(profile) {
  const p = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
  const email_events =
    p.email_events && typeof p.email_events === 'object' && !Array.isArray(p.email_events) ? p.email_events : {};
  return { p, email_events };
}

async function markSent(userId, eventKey) {
  const user = await db.User.findByPk(userId);
  if (!user) return null;

  const { p, email_events } = getEventStore(user.profile);
  if (email_events[eventKey]) return user;

  await user.update({
    profile: {
      ...p,
      email_events: {
        ...email_events,
        [eventKey]: nowIso()
      }
    }
  });

  return user;
}

async function sendOnce({ userId, to, subject, title, message, footer, preheader, eventKey }) {
  if (!to) return { skipped: true, reason: 'missing_email' };

  const user = await db.User.findByPk(userId);
  if (!user) return { skipped: true, reason: 'missing_user' };

  const { email_events } = getEventStore(user.profile);
  if (email_events[eventKey]) return { skipped: true, reason: 'already_sent' };

  const html = generateEmailTemplate({
    title,
    message,
    footer,
    preheader
  });
  const text = [title, '', message, footer ? `\n${footer}` : ''].filter(Boolean).join('\n');

  // Step 1: Mark as sent FIRST so the event is recorded even if sending fails.
  // This prevents permanent silencing of the email event.
  try {
    await markSent(userId, eventKey);
  } catch (err) {
    logger.error('sendOnce markSent failed', { eventKey, userId, message: err?.message });
  }

  // Step 2: Try to send the email.
  try {
    await sendEmail({ to, subject, text, html });
    return { sent: true };
  } catch (err) {
    logger.error('sendOnce email failed (event already marked, will retry via cron)', {
      eventKey, userId, to, message: err?.message
    });
    return { sent: false, error: err?.message ?? 'sendEmail failed' };
  }
}

function displayName(user) {
  const raw = user?.first_name || user?.name || '';
  const name = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
  return name || 'there';
}

function passwordLoginBlock(user, plainPassword) {
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const password = typeof plainPassword === 'string' ? plainPassword.trim() : '';
  if (!email || !password) return '';

  return (
    `\n\nYou can also sign in with your email and password:\n` +
    `Email: ${email}\n` +
    `Password: ${password}\n\n` +
    `We recommend changing this password after your first sign-in.`
  );
}

async function sendCustomerWelcome({ user, plainPassword }) {
  const credentials = passwordLoginBlock(user, plainPassword);
  return sendOnce({
    userId: user.id,
    to: user.email,
    subject: 'Welcome to CarComfort EV charging and Car Wash services',
    title: 'Congratulations!',
    message:
      `Congratulations, ${displayName(user)}!\n\n` +
      `Welcome to CarComfort, America's first on-demand valet EV charging and car wash service provider. We're excited to provide you with our premium and convenient car care experience. Your account has been verified successfully. You can book services and manage your vehicles in the app. During an active booking, please use the app to safely communicate with your service provider and coordinate key exchange, ETA, and any special vehicle instructions.\n\n` +
      `Before your appointment, make sure your vehicle is safe to operate and has enough fuel or charge to reach the nearest service location. Please share your unique four-digit PIN with the service provider upon arrival to grant them access to your vehicle and confirm that the provider is wearing an official CarComfort polo with the company logo and ask to see their official CarComfort ID card. For EV owners, please make sure the bank card connected to your EV account has enough funds, otherwise you may incur charges on your final billing summary.` +
      credentials,
    footer: 'Thank you for trusting us with your vehicle. We look forward to providing you with our premium services. Our support team is always here if you have questions or need assistance.\n\nSincerely,\nCarComfort',
    preheader: 'Welcome to CarComfort - your account is verified and ready to use.',
    eventKey: 'customer_welcome'
  });
}

async function sendDriverWelcome({ user, plainPassword }) {
  const credentials = passwordLoginBlock(user, plainPassword);

  // Plain text with \n\n paragraph breaks — template converts to HTML automatically
  // No HTML tags — generateEmailTemplate escapes everything via textToEmailHtml
  const message = [
    `CarComfort`,
    ``,
    `Hello ${displayName(user)} the driver!`,
    ``,
    `Congratulations, and welcome to CarComfort, America's first on-demand valet EV charging and car wash service provider. We're excited to let you know your application has been approved to become a CarComfort service provider. We want to thank you for joining our growing network of professional service providers. As a CarComfort service provider, you play an important role in delivering exceptional valet service and creating premium experience for our customers.`,
    ``,
    `All service providers are required to wear the official CarComfort polo shirt with the company logo and present an official CarComfort ID card at every appointment. Customers cannot grant vehicle access without proper attire and authentication. Upon arrival, please confirm customer four-digit pin and take four exterior photos and ten interior photos before service, then repeat the photos after service is complete. For every booking, bring your full car wash kit and arrive wearing your CarComfort polo and ID card. For each car wash appointment, leave one green Wonder Wafer Island Breeze air freshener in the vehicle vent or placed it in the cup holder area, one white trash bag that will be used for trash or unidentified items, and one zip-lock bag for small personal items and leave it inside the customer's vehicle trunk so they can dispose it themselves. Do not trash customers' personal belongings and unidentified items!`,
    ``,
    `Finally, before starting service, confirm that the customer vehicle is safe to operate and has enough fuel or charge to reach the nearest service location. Use the app to communicate safely with the customer, coordinate key exchange and ETA, and ask any vehicle-related questions before pickup or during an active booking. Visit the CarComfort app learning center in the app to watch additional tutorial videos about our services.`,
    ``,
    `We're excited to work with you! We wish you continued success as part of the CarComfort team. Our support team is always available if you have questions or need assistance.`,
    ``,
    `Sincerely,`,
    `CarComfort`,
    credentials ? `\n${credentials}` : '',
  ].join('\n');

  return sendOnce({
    userId: user.id,
    to: user.email,
    subject: 'Welcome to CarComfort as a Service Provider',
    title: 'Welcome to CarComfort',
    message: message,
    footer: null,
    preheader: 'Welcome to CarComfort — your service provider account has been approved.',
    eventKey: 'driver_welcome'
  });
}

async function sendPasswordUpdatedEmail({ user, plainPassword }) {
  const to = typeof user?.email === 'string' ? user.email.trim() : '';
  if (!to) return { skipped: true, reason: 'missing_email' };

  const password = typeof plainPassword === 'string' ? plainPassword.trim() : '';
  if (!password) return { skipped: true, reason: 'missing_password' };

  const title = 'Your Car Comfort password was updated';
  const message =
    `Hi ${displayName(user)},\n\n` +
    `An administrator updated your account password.` +
    passwordLoginBlock(user, password);

  const html = generateEmailTemplate({
    title,
    message,
    footer: 'If you did not request this change, contact support immediately.',
    preheader: 'Your account password was updated.',
  });
  const text = [title, '', message, '\nIf you did not request this change, contact support immediately.'].join('\n');

  await sendEmail({ to, subject: title, text, html });
  return { sent: true };
}

async function sendDriverProfileCompleted({ user }) {
  return sendOnce({
    userId: user.id,
    to: user.email,
    subject: 'Thanks for completing your service provider profile',
    title: 'Thank you!',
    message:
      `Hi ${displayName(user)},\n\nThank you for completing your service provider profile. ` +
      `Your profile has been submitted for review. We'll email you once it's approved (or if we need changes).`,
    footer: 'We appreciate you joining Car Comfort.',
    preheader: 'Your service provider profile is complete and submitted.',
    eventKey: 'driver_profile_completed'
  });
}

async function sendDriverApproved({ user }) {
  return sendOnce({
    userId: user.id,
    to: user.email,
    subject: 'Your service provider account has been approved',
    title: "You're approved!",
    message:
      `Hello ${displayName(user)} the driver!\n\n` +
      `Congratulations, and welcome to CarComfort, America's first on-demand valet EV charging and car wash service provider. We're excited to let you know your application has been approved to become a CarComfort service provider. We want to thank you for joining our growing network of professional service providers. As a CarComfort service provider, you play an important role in delivering exceptional valet service and creating premium experience for our customers.\n\n` +
      `All service providers are required to wear the official CarComfort polo shirt with the company logo and present an official CarComfort ID card at every appointment. Customers cannot grant vehicle access without proper attire and authentication. Upon arrival, please confirm customer four-digit pin and take four exterior photos and ten interior photos before service, then repeat the photos after service is complete. For every booking, bring your full car wash kit and arrive wearing your CarComfort polo and ID card. For each car wash appointment, leave one green Wonder Wafer Island Breeze air freshener in the vehicle vent or placed it in the cup holder area, one white trash bag that will be used for trash or unidentified items, and one zip-lock bag for small personal items and leave it inside the customer's vehicle trunk so they can dispose it themselves. Do not trash customers' personal belongings and unidentified items!\n\n` +
      `Finally, before starting service, confirm that the customer vehicle is safe to operate and has enough fuel or charge to reach the nearest service location. Use the app to communicate safely with the customer, coordinate key exchange and ETA, and ask any vehicle-related questions before pickup or during an active booking. Visit the CarComfort app learning center in the app to watch additional tutorial videos about our services.`,
    footer: "We're excited to work with you! We wish you continued success as part of the CarComfort team. Our support team is always available if you have questions or need assistance.\n\nSincerely,\nCarComfort",
    preheader: 'Your CarComfort service provider account has been approved — welcome to the team.',
    eventKey: 'driver_approved'
  });
}

async function sendDriverRejected({ user, reason }) {
  const safeReason = String(reason || '').trim();
  const reasonBlock = safeReason ? `\n\nReason:\n${safeReason}\n\nPlease fix the issue and resubmit for approval.` : '';

  const eventKey = safeReason ? `driver_rejected:${Buffer.from(safeReason).toString('base64')}` : 'driver_rejected';
  return sendOnce({
    userId: user.id,
    to: user.email,
    subject: 'Action required: update your service provider profile',
    title: 'We need a small update',
    message:
      `Hi ${displayName(user)},\n\nYour service provider profile was reviewed and needs a correction before we can approve it.` +
      reasonBlock,
    footer: "If anything is unclear, reply to this email and we'll guide you.",
    preheader: 'Your service provider profile needs an update before approval.',
    eventKey
  });
}

module.exports = {
  sendCustomerWelcome,
  sendDriverWelcome,
  sendPasswordUpdatedEmail,
  sendDriverProfileCompleted,
  sendDriverApproved,
  sendDriverRejected
};

