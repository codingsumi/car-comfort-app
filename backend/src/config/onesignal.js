/**
 * OneSignal — use env only; never commit REST API keys.
 * ONESIGNAL_APP_ID, ONESIGNAL_ANDROID_CHANNEL_ID, ONESIGNAL_REST_API_KEY
 */
const { loadEnv } = require('./loadEnv');

function loadOneSignalConfig() {
  loadEnv();

  return {
    appId: process.env.ONESIGNAL_APP_ID || '',
    androidChannelId: process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '',
    restApiKey: process.env.ONESIGNAL_REST_API_KEY || '',
    webhookSecret: process.env.ONESIGNAL_WEBHOOK_SECRET || '',
  };
}

function isOneSignalWebhookConfigured() {
  return Boolean(loadOneSignalConfig().webhookSecret);
}

function isOneSignalConfigured() {
  const c = loadOneSignalConfig();
  return Boolean(c.appId && c.restApiKey);
}

module.exports = { loadOneSignalConfig, isOneSignalConfigured, isOneSignalWebhookConfigured };
