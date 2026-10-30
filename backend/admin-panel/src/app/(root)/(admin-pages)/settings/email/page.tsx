'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { EmailSettingsPanel } from '@/components/settings/EmailSettingsPanel';

export default function EmailSettingsPage() {
  return (
    <>
      <PageHeader title="Email Settings" description="SMTP configuration and email delivery" />
      <SettingsSectionCard>
        <EmailSettingsPanel />
      </SettingsSectionCard>
    </>
  );
}
