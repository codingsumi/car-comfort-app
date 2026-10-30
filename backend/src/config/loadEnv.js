const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) return;

  // If the host already provides env vars (typical for production), dotenv is optional.
  // We still support .env files for convenience in dev / staging.
  const env = process.env.NODE_ENV || 'development';
  const root = process.cwd();
  const projectRoot = path.join(__dirname, '..', '..');

  const candidates = [
    process.env.DOTENV_CONFIG_PATH,
    env ? path.join(root, `.env.${env}`) : null,
    path.join(root, '.env'),
    env ? path.join(projectRoot, `.env.${env}`) : null,
    path.join(projectRoot, '.env')
  ].filter(Boolean);

  let loadedAny = false;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p, override: false });
        loadedAny = true;
      }
    } catch (_e) {
      // Ignore file system issues and continue; runtime env vars may still be set.
    }
  }

  loaded = loadedAny || Boolean(process.env.NODE_ENV);
}

module.exports = { loadEnv };
