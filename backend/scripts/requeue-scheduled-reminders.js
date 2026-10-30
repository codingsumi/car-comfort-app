#!/usr/bin/env node
'use strict';

/**
 * Re-queue scheduled service reminders (24h / 12h / 5h / 2h / 1h) for upcoming bookings.
 *
 * Usage (from repo root):
 *   NODE_ENV=production node scripts/requeue-scheduled-reminders.js
 *   NODE_ENV=production node scripts/requeue-scheduled-reminders.js 615 617 609
 *   NODE_ENV=production node scripts/requeue-scheduled-reminders.js --send-missed
 *   NODE_ENV=production node scripts/requeue-scheduled-reminders.js 615 --send-missed --dry-run
 *
 * --send-missed  Immediately deliver reminders whose scheduled time already passed (e.g. missed 24h).
 * --dry-run      List bookings and actions without writing to Redis or sending push.
 */

const { loadEnv } = require('../src/config/loadEnv');

loadEnv();

const { Op } = require('sequelize');
const db = require('../src/models');
const { isScheduledBookingForReminders } = require('../src/constants/bookingAfterBookingMessages');
const { loadNotificationConfig } = require('../src/modules/configs/notification.config');
const { scheduleBookingNotificationPipeline } = require('../src/modules/queues/notification.queue');
const { processScheduleReminder } = require('../src/modules/notifications/notification.processor');

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const sendMissed = argv.includes('--send-missed');
  const bookingIds = argv
    .filter((a) => /^\d+$/.test(a))
    .map((a) => Number(a))
    .filter((id) => id > 0);
  return { dryRun, sendMissed, bookingIds };
}

async function findBookings(bookingIds) {
  const baseWhere = {
    status: { [Op.in]: ['confirmed', 'assigned', 'in_progress'] },
    [Op.or]: [{ provider_id: { [Op.ne]: null } }, { assigned_driver_user_id: { [Op.ne]: null } }],
  };

  if (bookingIds.length) {
    return db.Booking.findAll({ where: { ...baseWhere, id: { [Op.in]: bookingIds } } });
  }

  const now = new Date();
  return db.Booking.findAll({
    where: {
      ...baseWhere,
      [Op.or]: [
        { schedule_type: 'scheduled' },
        { service_datetime: { [Op.gt]: now } },
        { scheduled_at: { [Op.gt]: now } },
      ],
    },
    order: [['service_datetime', 'ASC'], ['scheduled_at', 'ASC'], ['id', 'ASC']],
    limit: 200,
  });
}

function missedOffsetsForBooking(plain, offsetsMin) {
  const serviceAt = plain.service_datetime || plain.scheduled_at;
  if (!serviceAt) return [];
  const svcMs = new Date(serviceAt).getTime();
  if (!Number.isFinite(svcMs) || svcMs <= Date.now()) return [];

  return offsetsMin.filter((min) => svcMs - min * 60 * 1000 < Date.now());
}

async function main() {
  const { dryRun, sendMissed, bookingIds } = parseArgs(process.argv.slice(2));
  const cfg = loadNotificationConfig();

  const bookings = await findBookings(bookingIds);
  const eligible = bookings.filter((b) => isScheduledBookingForReminders(b.get({ plain: true })));

  if (!eligible.length) {
    console.log('No eligible scheduled bookings found.');
    if (bookingIds.length) {
      console.log(`Requested IDs: ${bookingIds.join(', ')}`);
    }
    process.exit(0);
  }

  console.log(`Found ${eligible.length} scheduled booking(s) with an assigned provider.\n`);

  const summary = [];

  for (const booking of eligible) {
    const plain = booking.get({ plain: true });
    const serviceAt = plain.service_datetime || plain.scheduled_at;
    const providerId = plain.provider_id || plain.assigned_driver_user_id;
    const missed = missedOffsetsForBooking(plain, cfg.reminderOffsetsMin);

    console.log(
      `Booking #${plain.id} | status=${plain.status} | service=${serviceAt} | provider=${providerId}`
    );

    if (dryRun) {
      console.log(`  would re-queue future offsets: ${cfg.reminderOffsetsMin.filter((m) => !missed.includes(m)).join(', ') || '(none)'}`);
      if (sendMissed && missed.length) {
        console.log(`  would send missed now (min): ${missed.join(', ')}`);
      }
      summary.push({ bookingId: plain.id, dryRun: true, missed });
      continue;
    }

    const queueResult = await scheduleBookingNotificationPipeline(plain);
    console.log('  re-queued:', JSON.stringify(queueResult));

    let sentMissed = [];
    if (sendMissed && missed.length) {
      for (const min of missed) {
        const phase = `${min}min`;
        try {
          const result = await processScheduleReminder({
            bookingId: plain.id,
            reminderPhase: phase,
          });
          console.log(`  missed ${phase}:`, JSON.stringify(result));
          sentMissed.push(phase);
        } catch (err) {
          console.error(`  missed ${phase} failed:`, err?.message || err);
        }
      }
    }

    summary.push({ bookingId: plain.id, queueResult, sentMissed });
  }

  console.log('\nDone.');
  console.log(JSON.stringify(summary, null, 2));
  await db.sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
