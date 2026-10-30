'use client';

import { useMemo } from 'react';
import { getApiBaseUrl } from '@/lib/paths';

/**
 * Setup checklist shown in admin settings — webhooks are configured in OneSignal + server env, not via the Web SDK.
 */
export function OneSignalWebhookInfo() {
  const webhookUrl = useMemo(
    () => `${getApiBaseUrl().replace(/\/$/, '')}/webhooks/onesignal/events`,
    []
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <h3 className="text-sm font-semibold text-secondary-900">Event Stream webhook (open / click analytics)</h3>
      <p className="mt-2 text-sm text-neutral-500">
        The OneSignal Web SDK does not configure webhooks. Analytics update when OneSignal POSTs events to your API.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-secondary-600">
        <li>
          Set <code className="rounded bg-white px-1 text-xs">ONESIGNAL_WEBHOOK_SECRET</code> in the API server{' '}
          <code className="rounded bg-white px-1 text-xs">.env</code> (done if you added the secret).
        </li>
        <li>
          Set <code className="rounded bg-white px-1 text-xs">ONESIGNAL_APP_ID</code> and{' '}
          <code className="rounded bg-white px-1 text-xs">ONESIGNAL_REST_API_KEY</code> to the same app as your mobile/Web SDK.
        </li>
        <li>
          In OneSignal → <strong>Data → Event Streams</strong>, add a <strong>Webhook</strong> destination:
          <ul className="mt-1 list-disc pl-5 text-neutral-500">
            <li>
              URL: <code className="break-all text-xs">{webhookUrl}</code>
            </li>
            <li>
              Header: <code className="text-xs">Authorization: Bearer &lt;ONESIGNAL_WEBHOOK_SECRET&gt;</code>
            </li>
            <li>Events: at least <code className="text-xs">message.push.clicked</code> (and optionally{' '}
              <code className="text-xs">message.push.received</code>, <code className="text-xs">message.push.failed</code>)
            </li>
            <li>
              Body: use template from <code className="text-xs">docs/api/onesignal-event-stream-template.json</code>
            </li>
          </ul>
        </li>
        <li>API must be reachable on the public internet (use ngrok locally).</li>
        <li>
          Send a test from <strong>Notifications → Create</strong>, then tap the push on a device. Check{' '}
          <strong>Notifications → Logs</strong> for <code className="text-xs">clicked</code> status.
        </li>
        <li>
          Customer/driver apps must call <code className="text-xs">POST /api/notifications/register-device</code> and{' '}
          <code className="text-xs">OneSignal.login(String(userId))</code> so events correlate to users.
        </li>
        <li>Run <code className="text-xs">npm run worker:notifications</code> when sending campaigns.</li>
      </ol>

      <p className="mt-4 text-xs text-neutral-400">
        Web SDK (<code className="text-xs">OneSignalSDK.page.js</code>) only registers browser subscriptions — it does not send webhook events by itself.
      </p>
    </div>
  );
}
