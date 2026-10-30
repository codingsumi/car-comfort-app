require('dotenv').config();

const { sendEmail } = require('../src/services/email.service');
const { generateEmailTemplate } = require('../utils/emailTemplate');

async function main() {
  const to = process.argv[2];
  if (!to) {
    // eslint-disable-next-line no-console
    console.error('Usage: node scripts/send-test-email.js you@example.com');
    process.exit(1);
  }

  const html = generateEmailTemplate({
    title: 'Verify your sign-up',
    message:
      'This is a test of the Car Comfort email template. If you see the styled card and logo, HTML email is working.',
    code: '123456',
    footer: 'You requested a test message from Car Comfort.',
    preheader: 'SMTP test — template preview.'
  });

  await sendEmail({
    to,
    subject: 'Car Comfort SMTP test',
    text: 'If you received this, SMTP is working. Test code: 123456',
    html
  });

  // eslint-disable-next-line no-console
  console.log('Done');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

