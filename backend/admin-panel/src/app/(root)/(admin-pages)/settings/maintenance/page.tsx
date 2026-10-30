'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default function MaintenanceSettingsPage() {
  return (
    <>
      <PageHeader
        title="Maintenance Mode"
        description="Block customer and provider apps while keeping admin access"
      />
      <SettingsSectionCard>
        <SettingsForm
          group="maintenance"
          title="Maintenance"
          description="When enabled, customer and provider apps are blocked. Admin panel remains accessible. The maintenance switch saves to the database as soon as you turn it on or off."
        />
      </SettingsSectionCard>
    </>
  );
}
