'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge, EmptyState } from '@/components/ui';
import { SecurityNav } from '@/components/security/SecurityNav';
import { securityService } from '@/services/security.service';
import { formatActionLabel, severityVariant } from '@/components/security/formatters';

export default function SecurityLogDetailPage() {
  const { id } = useParams();
  const logId = String(id ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['security-log', logId],
    queryFn: () => securityService.getLog(logId).then((r) => r.data.data),
    enabled: !!logId,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Log detail" />
        <SecurityNav />
        <div className="card h-48 animate-pulse bg-neutral-50" />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Log detail" />
        <SecurityNav />
        <EmptyState title="Log not found" description="This audit entry may have been removed." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Log #${data.id}`}
        description={formatActionLabel(data.action_type)}
        actions={
          <Link href="/security/logs" className="btn-outline text-sm">
            Back to logs
          </Link>
        }
      />
      <SecurityNav />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <h3 className="font-semibold text-secondary-900">Summary</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-neutral-400">Admin</dt>
            <dd>{data.admin?.name || '—'}</dd>
            <dt className="text-neutral-400">Module</dt>
            <dd>{data.module || '—'}</dd>
            <dt className="text-neutral-400">Entity</dt>
            <dd>
              {data.entity_type}
              {data.entity_id != null ? ` #${data.entity_id}` : ''}
            </dd>
            <dt className="text-neutral-400">Severity</dt>
            <dd>
              <Badge variant={severityVariant(data.severity)}>{data.severity}</Badge>
            </dd>
            <dt className="text-neutral-400">IP</dt>
            <dd>{data.ip_address || '—'}</dd>
            <dt className="text-neutral-400">Device</dt>
            <dd className="col-span-1 break-all">{data.device_info || '—'}</dd>
            <dt className="text-neutral-400">Timestamp</dt>
            <dd>{new Date(data.created_at).toLocaleString()}</dd>
            {data.api_endpoint && (
              <>
                <dt className="text-neutral-400">API endpoint</dt>
                <dd className="break-all">{data.api_endpoint}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-secondary-900">Change details</h3>
          {data.old_values || data.new_values ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <JsonBlock title="Before" data={data.old_values} />
              <JsonBlock title="After" data={data.new_values} />
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No before/after values recorded.</p>
          )}
        </div>
      </div>

      {(data.details || data.request_metadata) && (
        <div className="card mt-6 space-y-4">
          <h3 className="font-semibold text-secondary-900">Request metadata</h3>
          <JsonBlock title="Details" data={data.details} />
          {data.request_metadata && <JsonBlock title="Metadata" data={data.request_metadata} />}
        </div>
      )}
    </>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  if (!data) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs text-secondary-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
