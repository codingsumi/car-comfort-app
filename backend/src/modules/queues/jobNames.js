module.exports = {
  JOB_SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  JOB_SCHEDULE_REMINDER: 'SCHEDULE_REMINDER',
  /** Push-only nearby booking alert — no inbox / notification_log rows */
  JOB_NEW_BOOKING_ALERT: 'NEW_BOOKING_ALERT',
  /** Admin campaign scheduled send trigger */
  JOB_CAMPAIGN_SEND: 'CAMPAIGN_SEND',
  /** Admin campaign batched recipient delivery */
  JOB_CAMPAIGN_BATCH: 'CAMPAIGN_BATCH',
  /** On-demand accept / arrival-wait timers */
  JOB_BOOKING_TIMER: 'BOOKING_TIMER',
};
