const crypto = require('crypto');

/** BullMQ custom job IDs must NOT contain `:`. Use a safe delimiter. */
function deterministicJobId(prefix, uniqueKey) {
  const h = crypto.createHash('sha256').update(String(uniqueKey)).digest('hex').slice(0, 48);
  const p = String(prefix).replace(/:/g, '-');
  return `${p}-${h}`;
}

module.exports = { deterministicJobId };
