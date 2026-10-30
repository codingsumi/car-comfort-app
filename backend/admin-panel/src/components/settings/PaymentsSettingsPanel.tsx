'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import { settingsService } from '@/services/settings.service';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Types & pure helpers (defined outside component so they never re-create)
// ─────────────────────────────────────────────

type StripeKeys = {
  publishable_key_test: string;
  secret_key_test: string;
  publishable_key_live: string;
  secret_key_live: string;
  webhook_secret: string;
};

function keyPrefix(key: string): 'test' | 'live' | 'unknown' {
  if (key.startsWith('pk_test_') || key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('pk_live_') || key.startsWith('sk_live_')) return 'live';
  return 'unknown';
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return key;
  return key.slice(0, 14) + '••••••••••••' + key.slice(-4);
}

// ─────────────────────────────────────────────
// KeyField — standalone so React never unmounts/remounts it on parent re-render
// ─────────────────────────────────────────────

interface KeyFieldProps {
  label: string;
  fieldKey: keyof StripeKeys;
  placeholder: string;
  value: string;
  expectedPrefix: 'test' | 'live';
  onChange: (fieldKey: keyof StripeKeys, value: string) => void;
}

function KeyField({ label, fieldKey, placeholder, value, expectedPrefix, onChange }: KeyFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const isMasked = value.includes('\u2022');
  const prefix = keyPrefix(value);
  const mismatch = !!(value && !isMasked && prefix !== 'unknown' && prefix !== expectedPrefix);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2 ${
            mismatch
              ? 'border-red-400 bg-red-50 focus:ring-red-300'
              : value
              ? 'border-green-400 bg-green-50 focus:ring-green-300'
              : 'border-neutral-200 bg-white focus:ring-blue-300'
          }`}
          placeholder={placeholder}
          value={revealed ? value : value ? maskKey(value) : ''}
          readOnly={!revealed}
          onChange={e => onChange(fieldKey, e.target.value)}
        />
        <button
          type="button"
          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            revealed
              ? 'border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
          onClick={() => setRevealed(r => !r)}
        >
          {revealed ? 'Hide' : 'Edit'}
        </button>
      </div>
      <div className="mt-1 min-h-[18px]">
        {value && !mismatch && (
          <span className="text-xs font-semibold text-green-600">
            {prefix === 'live' ? '🟢 live key saved' : '🧪 test key saved'}
          </span>
        )}
        {mismatch && (
          <span className="text-xs font-semibold text-red-600">
            ⚠️ This field expects a <strong>{expectedPrefix}</strong> key — please enter the correct one.
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WebhookField — same pattern, standalone
// ─────────────────────────────────────────────

interface WebhookFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function WebhookField({ value, onChange }: WebhookFieldProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="mb-5">
      <label className="mb-1 block text-sm font-medium text-neutral-700">Webhook Secret (whsec_…)</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="whsec_…"
          value={revealed ? value : value ? maskKey(value) : ''}
          readOnly={!revealed}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            revealed
              ? 'border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
          onClick={() => setRevealed(r => !r)}
        >
          {revealed ? 'Hide' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────

export function PaymentsSettingsPanel() {
  const [testing, setSwitching2]  = useState(false);
  const [mode, setMode]           = useState<'test' | 'live' | null>(null);
  const [switching, setSwitching] = useState(false);
  const [confirm, setConfirm]     = useState(false);
  const [saving, setSaving]       = useState(false);

  const [keys, setKeys] = useState<StripeKeys>({
    publishable_key_test: '',
    secret_key_test: '',
    publishable_key_live: '',
    secret_key_live: '',
    webhook_secret: '',
  });

  const handleKeyChange = useCallback((fieldKey: keyof StripeKeys, value: string) => {
    setKeys(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleWebhookChange = useCallback((value: string) => {
    setKeys(prev => ({ ...prev, webhook_secret: value }));
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsService.getByGroup('stripe') as Record<string, { value: unknown }>;
      const val = data['stripe_payment_mode']?.value;
      if (val === 'live' || val === 'test') setMode(val);

      // Helper: extract string value; sensitive fields come back masked ('••••') — keep as-is for display
      const str = (key: string) => String(data[key]?.value ?? '').trim();

      const pkTest = str('stripe_publishable_key_test');
      const skTest = str('stripe_secret_key_test');  // sensitive — returns masked
      const pkLive = str('stripe_publishable_key_live');
      const skLive = str('stripe_secret_key_live');  // sensitive — returns masked
      const wh     = str('stripe_webhook_secret');   // sensitive — returns masked

      setKeys(prev => ({
        publishable_key_test: pkTest || prev.publishable_key_test,
        publishable_key_live: pkLive || prev.publishable_key_live,
        secret_key_test:      skTest || prev.secret_key_test,
        secret_key_live:      skLive || prev.secret_key_live,
        webhook_secret:       wh     || prev.webhook_secret,
      }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const handleTestStripe = async () => {
    setSwitching2(true);
    try {
      const result = await settingsService.testStripe();
      toast.success(`Stripe connected (${result.livemode ? 'live' : 'test'} mode)`);
    } catch {
      toast.error('Stripe connection failed — check your secret key');
    } finally {
      setSwitching2(false);
    }
  };

  const switchMode = async (next: 'test' | 'live') => {
    if (next === mode) return;
    if (next === 'live' && !confirm) { setConfirm(true); return; }
    setSwitching(true);
    setConfirm(false);
    try {
      await settingsService.updateByGroup('stripe', { stripe_payment_mode: next });
      setMode(next);
      toast.success(`Stripe switched to ${next === 'live' ? '🟢 Live' : '🧪 Test'} mode`);
    } catch {
      toast.error('Failed to switch Stripe mode — try again');
    } finally {
      setSwitching(false);
    }
  };

  const saveKeys = async () => {
    if (!mode) return;
    const pk = mode === 'live' ? keys.publishable_key_live : keys.publishable_key_test;
    const sk = mode === 'live' ? keys.secret_key_live      : keys.secret_key_test;

    // A masked value looks like 'sk_live_••••••••••••xxxx' — don't treat it as a real key to save
    const isMasked = (v: string) => v.includes('•');
    const skIsReal = sk && !isMasked(sk) && sk.startsWith(`sk_${mode}_`);
    const skHasValue = sk && !isMasked(sk);

    if (!pk.startsWith(`pk_${mode}_`)) {
      toast.error(`Publishable key must start with pk_${mode}_`);
      return;
    }
    if (skHasValue && !sk.startsWith(`sk_${mode}_`)) {
      toast.error(`Secret key must start with sk_${mode}_`);
      return;
    }

    setSaving(true);
    try {
      // Save only to the mode-specific fields — no legacy fields (they were removed)
      const payload: Record<string, string> = {
        [`stripe_publishable_key_${mode}`]: pk,
        ...(skIsReal ? { [`stripe_secret_key_${mode}`]: sk } : {}),
        ...(keys.webhook_secret && !isMasked(keys.webhook_secret)
          ? { stripe_webhook_secret: keys.webhook_secret }
          : {}),
      };
      await settingsService.updateByGroup('stripe', payload);
      toast.success('Stripe keys saved');
      await loadSettings();
    } catch {
      toast.error('Failed to save keys');
    } finally {
      setSaving(false);
    }
  };

  const isLive = mode === 'live';
  const activePublishableKey = mode === 'live' ? keys.publishable_key_live : keys.publishable_key_test;
  const activeSecretKey      = mode === 'live' ? keys.secret_key_live      : keys.secret_key_test;
  const hasMismatch = !!(
    (activePublishableKey && keyPrefix(activePublishableKey) !== 'unknown' && keyPrefix(activePublishableKey) !== 'unknown' && mode && keyPrefix(activePublishableKey) !== mode) ||
    (activeSecretKey      && keyPrefix(activeSecretKey)      !== 'unknown' && !activeSecretKey.includes('\u2022') && mode && keyPrefix(activeSecretKey) !== mode)
  );

  return (
    <div className="space-y-6">

      {/* ── Mode Banner ── */}
      <div className={`rounded-xl border-2 p-5 ${isLive ? 'border-green-400 bg-green-50' : 'border-yellow-400 bg-yellow-50'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xl ${isLive ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {isLive ? '🟢' : '🧪'}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Stripe Payment Mode</p>
              <p className={`text-xl font-bold ${isLive ? 'text-green-700' : 'text-yellow-700'}`}>
                {mode === null ? 'Loading…' : isLive ? 'LIVE — Real Payments Active' : 'TEST — No Real Charges'}
              </p>
              <p className={`mt-0.5 text-xs ${isLive ? 'text-green-600' : 'text-yellow-600'}`}>
                {isLive ? 'Customers are being charged real money.' : 'Safe for testing. No real money is charged.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void switchMode('test')} disabled={switching || mode === 'test'}
              className={`rounded-lg border-2 px-5 py-2 text-sm font-semibold transition-all ${mode === 'test' ? 'cursor-default border-yellow-400 bg-yellow-400 text-white' : 'border-yellow-300 bg-white text-yellow-700 hover:bg-yellow-50'}`}>
              🧪 Test Mode
            </button>
            <button onClick={() => void switchMode('live')} disabled={switching || mode === 'live'}
              className={`rounded-lg border-2 px-5 py-2 text-sm font-semibold transition-all ${mode === 'live' ? 'cursor-default border-green-500 bg-green-500 text-white' : 'border-green-400 bg-white text-green-700 hover:bg-green-50'}`}>
              🟢 Live Mode
            </button>
          </div>
        </div>
        {confirm && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">⚠️ Switching to <strong>Live Mode</strong> — real customer payments will be processed.</p>
            <p className="mt-1 text-xs text-red-600">Make sure your live keys (pk_live_ / sk_live_) are saved below before confirming.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void switchMode('live')} disabled={switching}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                {switching ? 'Switching…' : 'Yes, switch to Live'}
              </button>
              <button onClick={() => setConfirm(false)}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mismatch warning ── */}
      {hasMismatch && mode && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 p-4">
          <p className="font-semibold text-red-700">🚨 Key mismatch detected!</p>
          <p className="mt-1 text-sm text-red-600">
            Mode is <strong>{mode.toUpperCase()}</strong> but the saved keys are <strong>{mode === 'live' ? 'TEST' : 'LIVE'}</strong> keys.
            Save the correct {mode} keys below.
          </p>
        </div>
      )}

      {/* ── Keys panel ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-base font-semibold text-neutral-900">Stripe API Keys</h3>
        <p className="mb-5 text-sm text-neutral-400">
          Click <strong>Edit</strong> to reveal and update a key. Only the active mode&apos;s keys are sent to the backend on Save.
        </p>

        {/* Test keys */}
        <div className={`mb-6 rounded-lg border-2 p-4 ${mode === 'test' ? 'border-yellow-400 bg-yellow-50' : 'border-neutral-100 bg-neutral-50'}`}>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">🧪</span>
            <span className="font-semibold text-neutral-700">Test Keys</span>
            {mode === 'test' && <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-white">ACTIVE</span>}
          </div>
          <div className="space-y-4">
            <KeyField label="Test Publishable Key (pk_test_…)" fieldKey="publishable_key_test" placeholder="pk_test_…" value={keys.publishable_key_test} expectedPrefix="test" onChange={handleKeyChange} />
            <KeyField label="Test Secret Key (sk_test_…)"      fieldKey="secret_key_test"      placeholder="sk_test_…" value={keys.secret_key_test}      expectedPrefix="test" onChange={handleKeyChange} />
          </div>
        </div>

        {/* Live keys */}
        <div className={`mb-6 rounded-lg border-2 p-4 ${mode === 'live' ? 'border-green-400 bg-green-50' : 'border-neutral-100 bg-neutral-50'}`}>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">🟢</span>
            <span className="font-semibold text-neutral-700">Live Keys</span>
            {mode === 'live' && <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">ACTIVE</span>}
          </div>
          <div className="space-y-4">
            <KeyField label="Live Publishable Key (pk_live_…)" fieldKey="publishable_key_live" placeholder="pk_live_…" value={keys.publishable_key_live} expectedPrefix="live" onChange={handleKeyChange} />
            <KeyField label="Live Secret Key (sk_live_…)"      fieldKey="secret_key_live"      placeholder="sk_live_…" value={keys.secret_key_live}      expectedPrefix="live" onChange={handleKeyChange} />
          </div>
        </div>

        {/* Webhook */}
        <WebhookField value={keys.webhook_secret} onChange={handleWebhookChange} />

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <p className="text-xs text-neutral-400">Saves the <strong>{mode ?? '…'}</strong> mode keys to the backend.</p>
          <Button onClick={() => void saveKeys()} loading={saving}>Save Keys</Button>
        </div>
      </div>

      {/* ── Test connection ── */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">Use this to verify the active secret key can reach Stripe.</p>
        <Button className="mt-3" variant="secondary" onClick={() => void handleTestStripe()} loading={testing}>
          Test Stripe Connection
        </Button>
      </div>
    </div>
  );
}
