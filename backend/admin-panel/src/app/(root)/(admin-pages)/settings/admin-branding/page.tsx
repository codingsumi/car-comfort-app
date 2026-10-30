'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { AdminBrandingForm } from '@/components/settings/AdminBrandingForm';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';

export default function AdminBrandingPage() {
  return (
    <>
      <PageHeader
        title="Admin Panel Branding"
        description="Customize logo, favicon, colors, and theme for the admin dashboard"
      />
      <SettingsSectionCard>
        <AdminBrandingForm />
      </SettingsSectionCard>
    </>
  );
}
