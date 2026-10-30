'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="Fees & Taxes"
        description="Platform commission, tax, cancellation, and convenience fees"
      />
      <SettingsSectionCard>
        <SettingsForm
          group="finance"
          title="Fees & Taxes"
          description="Platform commission, tax, cancellation, and convenience fees"
        />
      </SettingsSectionCard>
    </>
  );
}
