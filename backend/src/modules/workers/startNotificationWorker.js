const { loadEnv } = require('../../config/loadEnv');

loadEnv();

const { logger } = require('../../config/logger');
const { registerNotificationWorker } = require('./notification.worker');

const worker = registerNotificationWorker();

logger.info('Notification BullMQ worker started');

function shutdown(signal) {
  logger.info(`Notification worker shutting down (${signal})`);
  worker
    .close()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Worker shutdown error', { message: err?.message });
      process.exit(1);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason?.message || String(reason) });
});
