'use strict';

const { logger } = require('../../config/logger');
const { shouldEmbedNotificationWorker } = require('../configs/notification.config');
const { registerNotificationWorker } = require('./notification.worker');

let embeddedWorker = null;

function startEmbeddedNotificationWorker() {
  if (embeddedWorker) return embeddedWorker;
  if (!shouldEmbedNotificationWorker()) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('notification_worker_not_embedded', {
        hint: 'Run npm run worker:notifications or set NOTIFICATION_EMBED_WORKER=true',
      });
    }
    return null;
  }
  try {
    embeddedWorker = registerNotificationWorker();
    logger.info('notification_worker_embedded', {
      nodeEnv: process.env.NODE_ENV || 'development',
    });
    return embeddedWorker;
  } catch (err) {
    logger.error('notification_worker_embedded_failed', {
      message: err?.message,
      hint: 'Start Redis or set NOTIFICATION_INLINE_DELIVERY=true',
    });
    return null;
  }
}

async function stopEmbeddedNotificationWorker() {
  if (!embeddedWorker) return;
  const worker = embeddedWorker;
  embeddedWorker = null;
  await worker.close();
  logger.info('notification_worker_embedded_stopped');
}

module.exports = {
  shouldEmbedNotificationWorker,
  startEmbeddedNotificationWorker,
  stopEmbeddedNotificationWorker,
};
