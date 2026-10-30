#!/usr/bin/env node
'use strict';

/**
 * Compare platform Stripe balance vs provider wallet liabilities.
 *
 * Usage (from repo root, with .env / DB configured):
 *   node scripts/diagnose-payout-gap.js
 *   node scripts/diagnose-payout-gap.js --provider-id=123
 */

require('dotenv').config();

const db = require('../src/models');
const { getPlatformBalanceAmounts } = require('../src/services/stripeBalance.service');

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

function parseProviderId(argv) {
  const flag = argv.find((a) => a.startsWith('--provider-id='));
  if (!flag) return null;
  const id = Number(flag.split('=')[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function main() {
  const providerId = parseProviderId(process.argv.slice(2));

  const wallets = await db.ProviderWallet.findAll({
    attributes: ['provider_id', 'pending_balance', 'available_for_payout', 'currency'],
    raw: true,
  });

  const totalInternalAvailable = roundTwo(
    wallets.reduce((s, w) => s + Number(w.available_for_payout || 0), 0)
  );
  const totalInternalPending = roundTwo(
    wallets.reduce((s, w) => s + Number(w.pending_balance || 0), 0)
  );

  let stripeBalance = null;
  let stripeError = null;
  try {
    stripeBalance = await getPlatformBalanceAmounts({ currency: 'usd' });
  } catch (err) {
    stripeError = err?.message || String(err);
  }

  const stripeAvailable = stripeBalance ? roundTwo(stripeBalance.available) : null;
  const stripePending = stripeBalance ? roundTwo(stripeBalance.pending) : null;
  const gap =
    stripeAvailable != null
      ? roundTwo(Math.max(0, totalInternalAvailable - stripeAvailable))
      : null;

  console.log('\n=== Car Comfort payout gap diagnostic ===\n');
  console.log('Provider wallets (DB ledger)');
  console.log(`  Drivers with wallet rows:     ${wallets.length}`);
  console.log(`  Sum pending_balance:          $${totalInternalPending.toFixed(2)}`);
  console.log(`  Sum available_for_payout:     $${totalInternalAvailable.toFixed(2)}`);
  console.log('');

  if (stripeError) {
    console.log('Platform Stripe balance: ERROR');
    console.log(`  ${stripeError}`);
    console.log('  Fix Stripe secret key in Admin → Settings → Stripe (or STRIPE_SECRET_KEY).');
  } else {
    console.log('Platform Stripe balance (same account as payout transfers)');
    console.log(`  Available:                    $${stripeAvailable.toFixed(2)}`);
    console.log(`  Pending (settlement):         $${stripePending.toFixed(2)}`);
    console.log(`  Live mode:                    ${stripeBalance.livemode}`);
    console.log('');
    console.log('Payout feasibility');
    console.log(
      `  Unpayable ledger (internal − Stripe available): $${gap.toFixed(2)}`
    );
    if (gap > 0) {
      console.log('\n  → Drivers see earnings in the app but cannot withdraw until');
      console.log('    platform Stripe AVAILABLE balance covers their share.');
      console.log('  Common causes:');
      console.log('    • Card payments still settling (check Stripe → Balance → Pending)');
      console.log('    • Charges on a different Stripe account than API keys in admin');
      console.log('    • Refunds/disputes removed funds from the platform account');
      console.log('    • Manual transfers already drained platform balance');
    } else {
      console.log('\n  → Platform balance covers total driver liabilities (aggregate).');
    }
  }

  if (providerId) {
    const wallet = wallets.find((w) => Number(w.provider_id) === providerId);
    const user = await db.User.findByPk(providerId, {
      attributes: ['id', 'name', 'email', 'stripe_connect_account_id'],
    });
    console.log(`\n--- Provider #${providerId} ---`);
    if (!wallet) {
      console.log('  No provider_wallet row.');
    } else {
      const internal = roundTwo(wallet.available_for_payout);
      const payable =
        stripeAvailable != null ? roundTwo(Math.min(internal, stripeAvailable)) : null;
      console.log(`  internal available_for_payout: $${internal.toFixed(2)}`);
      if (payable != null) {
        console.log(`  withdrawable now (min w/ Stripe): $${payable.toFixed(2)}`);
        console.log(
          `  blocked by Stripe settlement:    $${roundTwo(Math.max(0, internal - payable)).toFixed(2)}`
        );
      }
    }
    console.log(`  Connect account: ${user?.stripe_connect_account_id || '(none)'}`);
  }

  const top = [...wallets]
    .sort((a, b) => Number(b.available_for_payout) - Number(a.available_for_payout))
    .slice(0, 5);
  if (top.length) {
    console.log('\nTop internal available_for_payout:');
    for (const w of top) {
      console.log(
        `  provider ${w.provider_id}: $${roundTwo(w.available_for_payout).toFixed(2)} (pending $${roundTwo(w.pending_balance).toFixed(2)})`
      );
    }
  }

  console.log('\n');
  await db.sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
