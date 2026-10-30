'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';

type ResetPasswordPayload = {
  password?: string;
  notify_email?: boolean;
};

type ResetPasswordResponse = {
  temp_password: string;
  email_sent?: boolean;
  message?: string;
};

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  accountLabel: string;
  userEmail?: string | null;
  authType?: string | null;
  onSubmit: (payload: ResetPasswordPayload) => Promise<ResetPasswordResponse>;
  isSubmitting?: boolean;
}

export function ResetPasswordModal({
  open,
  onClose,
  accountLabel,
  userEmail,
  authType,
  onSubmit,
  isSubmitting = false,
}: ResetPasswordModalProps) {
  const [mode, setMode] = useState<'generate' | 'custom'>('generate');
  const [customPassword, setCustomPassword] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [result, setResult] = useState<ResetPasswordResponse | null>(null);

  useEffect(() => {
    if (!open) {
      setMode('generate');
      setCustomPassword('');
      setNotifyEmail(true);
      setResult(null);
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    const payload: ResetPasswordPayload = { notify_email: notifyEmail };
    if (mode === 'custom') {
      const trimmed = customPassword.trim();
      if (trimmed.length < 8) return;
      payload.password = trimmed;
    }
    const response = await onSubmit(payload);
    setResult(response);
  };

  const isSocial = authType === 'social';
  const canNotify = Boolean(userEmail?.trim());

  return (
    <Modal open={open} onClose={handleClose} title="Set / Reset Password" size="sm">
      <div className="space-y-4">
        {!result ? (
          <>
            <p className="text-sm text-secondary-500">
              Set a new password for this {accountLabel}. All active sessions will be signed out.
              {isSocial ? ' Social sign-in accounts can use this password for email login too.' : ''}
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'generate' ? 'primary' : 'outline'}
                onClick={() => setMode('generate')}
              >
                Generate random
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'custom' ? 'primary' : 'outline'}
                onClick={() => setMode('custom')}
              >
                Set custom
              </Button>
            </div>

            {mode === 'custom' && (
              <Input
                label="New password"
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                hint="Minimum 8 characters"
                autoComplete="new-password"
              />
            )}

            {canNotify && (
              <Toggle
                label="Email password to user"
                description={userEmail || undefined}
                checked={notifyEmail}
                onChange={setNotifyEmail}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={mode === 'custom' && customPassword.trim().length < 8}
              >
                {mode === 'generate' ? 'Generate & apply' : 'Set password'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-success-100 bg-success-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-success">New password</p>
              <p className="mt-2 font-mono text-lg font-bold text-secondary-900">{result.temp_password}</p>
            </div>
            <p className="text-xs text-neutral-300">
              {result.email_sent
                ? 'The password was emailed to the user.'
                : result.message || 'Share this password securely with the user.'}
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
