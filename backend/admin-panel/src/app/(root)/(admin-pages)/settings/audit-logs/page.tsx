'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSectionCard } from '@/components/settings/SettingsSectionCard';
import { AuditLogViewer } from '@/components/settings/AuditLogViewer';

export default function SettingsAuditLogsPage() {
  return (
    <>
      <PageHeader title="Settings Audit Logs" description="Track all configuration changes" />
      <SettingsSectionCard>
        <AuditLogViewer />
      </SettingsSectionCard>
    </>
  );
}
