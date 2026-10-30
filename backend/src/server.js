const http = require('http');
const { loadEnv } = require('./config/loadEnv');

loadEnv();

const app = require('./app');
const db = require('./models');
const { logger } = require('./config/logger');
const { loadOneSignalConfig, isOneSignalConfigured, isOneSignalWebhookConfigured } = require('./config/onesignal');
const { attachRealtimeServer } = require('./modules/realtime/socketServer');
const { ensureBookingEvColumns } = require('./bootstrap/ensureBookingEvColumns');
const { ensureDriverProfileColumns } = require('./bootstrap/ensureDriverProfileColumns');
const {
  startEmbeddedNotificationWorker,
  stopEmbeddedNotificationWorker,
} = require('./modules/workers/notificationWorkerBootstrap');
const { startDriverLicenseComplianceScheduler } = require('./services/driverLicenseCompliance.service');
const { startScheduledBookingConverterScheduler } = require('./modules/bookings/scheduledBookingConverter.service');

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || 'localhost';

// ── Startup environment validation ───────────────────────────────────────────
// Fail fast in production if critical env vars are missing.
function validateRequiredEnv() {
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  if (!isProd) return; // Allow loose config in dev/test

  const missing = [];

  if (!process.env.CORS_ORIGIN) {
    missing.push('CORS_ORIGIN (must list allowed admin panel origins, e.g. https://admin.carcomfort.com)');
  }

  // STRIPE_WEBHOOK_SECRET is critical for security but not required to boot
  // (webhooks silently fail if unset rather than crashing the server).
  // Warn loudly but do not block startup — operators can add it without downtime.
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[WARN] STRIPE_WEBHOOK_SECRET is not set. Stripe webhook signature verification will throw on every webhook call. Set it to enable payment webhook processing.');
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n[FATAL] Missing required environment variables in production:');
    missing.forEach((m) => console.error(`  - ${m}`));
    console.error('\nServer will not start until these are configured.\n');
    process.exit(1);
  }
}

validateRequiredEnv();
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(app);
attachRealtimeServer(server);

async function startServer() {
  try {
    await ensureBookingEvColumns(db.sequelize);
    await ensureDriverProfileColumns(db.sequelize);
  } catch (err) {
    logger.error('ensure_booking_ev_columns_failed', {
      message: err?.message || String(err),
    });
    throw err;
  }

  server.listen(PORT, HOST, () => {
    startEmbeddedNotificationWorker();
    startDriverLicenseComplianceScheduler();
    startScheduledBookingConverterScheduler();
    const oneSignalConfig = loadOneSignalConfig();
    logger.info('server_runtime_config', {
      nodeEnv: process.env.NODE_ENV || 'development',
      host: HOST,
      port: PORT,
      dbHost: process.env.DB_HOST,
      dbPort: process.env.DB_PORT,
      dbName: process.env.DB_NAME,
      oneSignal: {
        configured: isOneSignalConfigured(),
        hasAppId: Boolean(oneSignalConfig.appId),
        hasRestApiKey: Boolean(oneSignalConfig.restApiKey),
        hasAndroidChannelId: Boolean(oneSignalConfig.androidChannelId),
        webhookConfigured: isOneSignalWebhookConfigured(),
      }
    });
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err?.message || err);
  process.exit(1);
});

async function shutdown(signal) {
  logger.info('server_shutting_down', { signal });
  await stopEmbeddedNotificationWorker();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
