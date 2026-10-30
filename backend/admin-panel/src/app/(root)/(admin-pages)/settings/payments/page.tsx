'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { PaymentsSettingsPanel } from '@/components/settings/PaymentsSettingsPanel';

export default function PaymentsSettingsPage() {
  return (
    <>
      <PageHeader title="Payment Settings" description="Stripe integration and gateway configuration" />
      <SettingsSectionCard>
        <PaymentsSettingsPanel />
      </SettingsSectionCard>
    </>
  );
}
