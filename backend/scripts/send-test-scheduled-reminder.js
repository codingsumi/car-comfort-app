#!/usr/bin/env node
'use strict';

/**
 * Quick test: send 24h scheduled reminder to the driver.
 *
 *   npm run test:reminder -- 617
 *   npm run test:reminder -- 617 customer   (send to customer instead)
 */

const { loadEnv } = require('../src/config/loadEnv');

loadEnv();

const db = require('../src/models');
const { sendScheduleReminderNow } = require('../src/modules/notifications/notification.processor');

async function main() {
  const bookingId = Number(process.argv[2]);
  const audience = process.argv[3] === 'customer' ? 'customer' : 'driver';

  if (!bookingId) {
    console.error('Usage: npm run test:reminder -- <booking-id> [customer]');
    process.exit(1);
  }

  const result = await sendScheduleReminderNow(
    { bookingId, reminderPhase: '1440min' },
    { audience, uniqueKeySuffix: `:test:${Date.now()}` }
  );

  if (result.skipped) {
    console.error(`Skipped: ${result.reason}`);
    process.exit(1);
  }

  const target = audience === 'customer' ? result.results?.customer : result.results?.driver;
  if (target?.skipped) {
    console.error(`Skipped: ${target.reason}`);
    process.exit(1);
  }

  console.log(`OK — ${audience} reminder sent for booking #${bookingId}`);
  await db.sequelize.close();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
