'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { InvoicePreviewPanel } from '@/components/settings/InvoicePreviewPanel';

export default function CompanySettingsPage() {
  return (
    <>
      <PageHeader title="Company & Invoice" description="Company details and invoice configuration" />
      <SettingsSectionCard>
        <InvoicePreviewPanel />
      </SettingsSectionCard>
    </>
  );
}
