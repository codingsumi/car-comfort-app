'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default function GeneralSettingsPage() {
  return (
    <>
      <PageHeader title="General Settings" description="App name, contact details, timezone, and currency" />
      <SettingsSectionCard>
        <SettingsForm group="general" title="General" description="Basic platform configuration" />
      </SettingsSectionCard>
    </>
  );
}
