'use strict';

const db = require('../models');
const { getStripeClientFromSettings } = require('../config/stripe');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function amountForCurrency(entries, currency) {
  const code = String(currency || 'usd').trim().toLowerCase();
  const cents = (Array.isArray(entries) ? entries : [])
    .filter((entry) => String(entry?.currency || '').toLowerCase() === code)
    .reduce((sum, entry) => sum + Number(entry?.amount || 0), 0);
  return roundTwo(cents / 100);
}

async function getPlatformBalanceAmounts({ currency = 'usd' } = {}) {
  const stripe = await getStripeClientFromSettings(db);
  const balance = await stripe.balance.retrieve();

  return {
    currency: String(currency || 'usd').trim().toLowerCase(),
    available: amountForCurrency(balance.available, currency),
    pending: amountForCurrency(balance.pending, currency),
    livemode: Boolean(balance.livemode),
  };
}

module.exports = { getPlatformBalanceAmounts };
