const db = require('../models');

function pad6(n) {
  return String(n).padStart(6, '0');
}

function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function serviceCode(serviceType) {
  if (serviceType === 'car_wash') return 'CW';
  if (serviceType === 'ev_charging') return 'EV';
  return 'CB';
}

/**
 * Atomic per-day sequence in MySQL using LAST_INSERT_ID trick.
 * Must be run within the same transaction as booking creation.
 */
async function nextBookingSequence({ bookingDate, transaction }) {
  await db.sequelize.query(
    `
    INSERT INTO booking_counters (booking_date, last_sequence)
    VALUES (?, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_sequence = LAST_INSERT_ID(last_sequence + 1)
  `,
    { replacements: [bookingDate], transaction }
  );

  const [[row]] = await db.sequelize.query(`SELECT LAST_INSERT_ID() AS seq`, { transaction });
  return Number(row?.seq || 0);
}

async function generateBookingCode({ serviceType, now, transaction }) {
  const dateStr = formatDateYYYYMMDD(now);
  const seq = await nextBookingSequence({ bookingDate: dateStr, transaction });
  const code = `CC-${serviceCode(serviceType)}-${dateStr}-${pad6(seq)}`;
  return { booking_code: code, booking_date: dateStr, sequence: seq };
}

module.exports = {
  generateBookingCode
};

