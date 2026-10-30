const { logger } = require('../config/logger');

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function isSmsConfigured() {
  const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
  if (provider !== 'signalwire') return false;
  return Boolean(
    process.env.SIGNALWIRE_PROJECT_ID &&
      process.env.SIGNALWIRE_TOKEN &&
      process.env.SIGNALWIRE_SPACE_URL &&
      process.env.SIGNALWIRE_FROM_NUMBER
  );
}

/** Local/dev: log SMS instead of calling SignalWire unless SMS_FORCE_SEND=true. */
function shouldMockSms() {
  const mockFlag = String(process.env.SMS_MOCK || '').toLowerCase();
  if (mockFlag === 'true') return true;
  if (mockFlag === 'false') return false;

  if (!isProduction()) {
    return String(process.env.SMS_FORCE_SEND || '').toLowerCase() !== 'true';
  }

  return !isSmsConfigured();
}

function logMockSms(to, text, reason = 'mock') {
  logger.info('mock_sms', { reason, to: to?.replace(/\d(?=\d{4})/g, '*'), text });
}

function toE164(input, { defaultCountryCode = '+1' } = {}) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw.replace(/[^\d+]/g, '');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function getSignalwireBaseUrl() {
  const host = String(process.env.SIGNALWIRE_SPACE_URL || '').trim();
  if (!host) return '';
  return host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
}

function toBasicAuth(username, password) {
  return Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
}

async function sendSms({ to, text }) {
  if (!to) return { skipped: true, reason: 'missing_to' };

  if (shouldMockSms()) {
    logMockSms(to, text, isSmsConfigured() ? 'local' : 'unconfigured');
    return { mocked: true };
  }

  const toNumber = toE164(to);
  const fromNumber = toE164(process.env.SIGNALWIRE_FROM_NUMBER);
  const baseUrl = getSignalwireBaseUrl();
  const projectId = String(process.env.SIGNALWIRE_PROJECT_ID || '').trim();
  const token = String(process.env.SIGNALWIRE_TOKEN || '').trim();

  const url = `${baseUrl}/api/laml/2010-04-01/Accounts/${encodeURIComponent(projectId)}/Messages.json`;
  const body = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Body: String(text || '')
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${toBasicAuth(projectId, token)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const raw = await res.text();
  if (!res.ok) {
    logger.error('SMS send failed', { status: res.status, to: toNumber, body: raw });
    if (!isProduction()) {
      logger.warn('SMS send failed in non-production; using mock fallback', {
        status: res.status,
        to: toNumber
      });
      logMockSms(toNumber, text, 'fallback');
      return { mocked: true, fallback: true };
    }
    const err = new Error('SMS send failed');
    err.statusCode = 502;
    err.details = { provider: 'signalwire', status: res.status };
    throw err;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (_e) {
    json = null;
  }

  const sid = json?.sid || json?.message_sid || undefined;
  logger.info('SMS sent', { to: toNumber, sid });
  return { mocked: false, sid };
}

module.exports = { sendSms };

