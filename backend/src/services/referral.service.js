const db = require('../models');

function generateReferralCodeCandidate() {
  const n = Math.floor(Math.random() * 1000000);
  return `CC${String(n).padStart(6, '0')}`;
}

async function ensureReferralCodeForUser(user) {
  if (!user) return null;
  if (user.referral_code) return user.referral_code;

  for (let i = 0; i < 12; i += 1) {
    const candidate = generateReferralCodeCandidate();
    // eslint-disable-next-line no-await-in-loop
    const exists = await db.User.findOne({ where: { referral_code: candidate }, attributes: ['id'] });
    if (exists) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await user.update({ referral_code: candidate });
      return candidate;
    } catch (_e) {
      // best-effort retry on rare collision / race
    }
  }

  return user.referral_code || null;
}

module.exports = {
  ensureReferralCodeForUser
};

