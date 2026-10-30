#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Ensure NODE_ENV is set *before* sequelize-cli reads it.
// - On servers, `.env.production` commonly exists but NODE_ENV may not be set in the shell.
// - Locally, default to development.
if (!process.env.NODE_ENV) {
  const root = process.cwd();
  const hasProdEnvFile = fs.existsSync(path.join(root, '.env.production'));
  process.env.NODE_ENV = hasProdEnvFile ? 'production' : 'development';
}

// Load env vars (DB_HOST/DB_PORT/etc.) before the CLI bootstraps.
// This is intentionally shared with the running app logic.
try {
  // eslint-disable-next-line global-require
  require('../src/config/loadEnv').loadEnv();
} catch (e) {
  console.error('Failed to load env file(s).', e?.message || e);
  process.exit(1);
}

const bin = path.resolve(process.cwd(), 'node_modules', '.bin', 'sequelize-cli');
const args = process.argv.slice(2);

if (!fs.existsSync(bin)) {
  console.error(
    'sequelize-cli is not installed. Run `npm install` (production deploys need sequelize-cli in dependencies).'
  );
  process.exit(1);
}

const result = spawnSync(bin, args, {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);

