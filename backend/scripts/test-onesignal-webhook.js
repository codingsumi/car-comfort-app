#!/usr/bin/env node
/**
 * Local smoke test for OneSignal webhook normalization (no HTTP).
 * Usage: node scripts/test-onesignal-webhook.js
 */
const { normalizeOnesignalEvent } = require('../src/services/onesignalWebhook.service');

const sampleClick = {
  'event.kind': 'message.push.clicked',
  'event.id': 'test-event-uuid',
  'event.datetime': '2024-02-21T23:45:15.228Z',
  'event.external_id': '42',
  'message.id': 'f3c9cd09-10d7-4f59-b9bc-66e16607f1d5',
  'message.data': {
    delivery_log_id: '1',
    campaign_id: '5',
    user_id: '42',
  },
};

const nested = {
  event: { kind: 'message.push.clicked', id: 'e2', datetime: '2024-02-21T23:45:15.228Z', external_id: '7' },
  message: { id: 'msg-abc', data: { delivery_log_id: '99', user_id: '7' } },
};

console.log('flat:', normalizeOnesignalEvent(sampleClick));
console.log('nested:', normalizeOnesignalEvent(nested));
