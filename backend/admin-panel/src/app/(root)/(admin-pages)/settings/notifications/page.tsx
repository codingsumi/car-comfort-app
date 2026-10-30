'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { NotificationsSettingsPanel } from '@/components/settings/NotificationsSettingsPanel';

export default function NotificationsSettingsPage() {
  return (
    <>
      <PageHeader title="Notification Settings" description="OneSignal and push notification preferences" />
      <SettingsSectionCard>
        <NotificationsSettingsPanel />
      </SettingsSectionCard>
    </>
  );
}
