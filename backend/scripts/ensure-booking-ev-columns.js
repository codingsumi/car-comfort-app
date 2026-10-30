#!/usr/bin/env node
'use strict';

const { loadEnv } = require('../src/config/loadEnv');

loadEnv();

const db = require('../src/models');
const { ensureBookingEvColumns } = require('../src/bootstrap/ensureBookingEvColumns');

async function main() {
  await ensureBookingEvColumns(db.sequelize);
  // eslint-disable-next-line no-console
  console.log('Booking EV columns are up to date.');
  await db.sequelize.close();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  try {
    await db.sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
