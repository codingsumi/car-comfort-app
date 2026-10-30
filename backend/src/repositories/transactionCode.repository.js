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

async function nextTxnSequence({ txnDate, transaction }) {
  await db.sequelize.query(
    `
    INSERT INTO booking_transaction_counters (txn_date, last_sequence)
    VALUES (?, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_sequence = LAST_INSERT_ID(last_sequence + 1)
  `,
    { replacements: [txnDate], transaction }
  );

  const [[row]] = await db.sequelize.query(`SELECT LAST_INSERT_ID() AS seq`, { transaction });
  return Number(row?.seq || 0);
}

async function generateTransactionCode({ now, transaction } = {}) {
  const dateStr = formatDateYYYYMMDD(now || new Date());
  const seq = await nextTxnSequence({ txnDate: dateStr, transaction });
  const code = `TXN-${dateStr}-${pad6(seq)}`;
  return { transaction_code: code, txn_date: dateStr, sequence: seq };
}

module.exports = { generateTransactionCode };

