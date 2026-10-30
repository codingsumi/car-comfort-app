'use client';

import { useState } from 'react';
import { SettingsForm } from './SettingsForm';
import { Button, Input } from '@/components/ui';
import { settingsService } from '@/services/settings.service';
import toast from 'react-hot-toast';

export function EmailSettingsPanel() {
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await settingsService.testEmail();
      toast.success('SMTP connection verified');
    } catch {
      toast.error('SMTP connection failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Enter a recipient email address');
      return;
    }
    setTesting(true);
    try {
      await settingsService.testEmail(testEmail);
      toast.success(`Test email sent to ${testEmail}`);
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsForm
        group="email"
        title="Email / SMTP"
        description="Configure outbound email delivery"
      />
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h4 className="text-sm font-semibold text-secondary-900">Email Tools</h4>
        <p className="mt-1 text-sm text-neutral-300">Verify SMTP connection or send a test email</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button variant="secondary" onClick={handleVerify} loading={verifying}>
            Verify Connection
          </Button>
          <div className="min-w-[220px]">
            <Input
              label="Test recipient"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <Button onClick={handleSendTest} loading={testing}>
            Send Test Email
          </Button>
        </div>
      </div>
    </div>
  );
}
