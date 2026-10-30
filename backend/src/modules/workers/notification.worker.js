const { Worker } = require('bullmq');
const { logger } = require('../../config/logger');
const { loadNotificationConfig } = require('../configs/notification.config');
const { createRedisConnection } = require('../configs/redis.connection');
const { routeNotificationJob } = require('../notifications/notification.processor');
const { JOB_SCHEDULE_REMINDER, JOB_SEND_NOTIFICATION } = require('../queues/jobNames');

function registerNotificationWorker() {
  const cfg = loadNotificationConfig();
  const connection = createRedisConnection();

  const worker = new Worker(
    cfg.queueName,
    async (job) => {
      logger.debug('Notification job processing', { name: job.name, id: job.id });
      return routeNotificationJob(job);
    },
    {
      connection,
      concurrency: cfg.workerConcurrency,
      stalledInterval: 30000,
      autorun: true
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('notification job failed', {
      jobId: job?.id,
      jobName: job?.name,
      message: err?.message
    });
  });

  worker.on('completed', (job, result) => {
    const payload = { jobId: job?.id, jobName: job?.name, result };
    if (job?.name === JOB_SCHEDULE_REMINDER || job?.name === JOB_SEND_NOTIFICATION) {
      logger.info('notification job finished', payload);
    } else {
      logger.debug('notification job finished', payload);
    }
  });

  return worker;
}

module.exports = { registerNotificationWorker };
