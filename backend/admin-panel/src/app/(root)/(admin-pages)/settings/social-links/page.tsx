'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default function SocialLinksSettingsPage() {
  return (
    <>
      <PageHeader title="Social Links" description="Social media profile URLs" />
      <SettingsSectionCard>
        <SettingsForm group="social_links" title="Social Links" description="URLs are validated before saving" />
      </SettingsSectionCard>
    </>
  );
}
