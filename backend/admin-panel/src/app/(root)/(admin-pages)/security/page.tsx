'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  UsersIcon,
  ShieldCheckIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  TrashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { securityService } from '@/services/security.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Badge, EmptyState } from '@/components/ui';
import { SecurityNav } from '@/components/security/SecurityNav';
import { LiveSecurityWidgets } from '@/components/security/LiveSecurityWidgets';
import { formatActionLabel, formatAlertType, severityVariant } from '@/components/security/formatters';
import type { ActivityLogRow, SecurityAlertRow } from '@/types/security';

export default function SecurityDashboardPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['security-dashboard'],
    queryFn: () => securityService.getDashboard().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const summary = data?.summary;

  const statCards = [
    { title: 'Admin users', value: summary?.total_admin_users ?? 0, icon: <UsersIcon className="h-5 w-5" /> },
    { title: 'Active sessions', value: summary?.active_admin_sessions ?? 0, icon: <ShieldCheckIcon className="h-5 w-5" /> },
    { title: 'Failed logins (24h)', value: summary?.failed_login_attempts_24h ?? 0, icon: <XCircleIcon className="h-5 w-5" /> },
    { title: 'Open alerts', value: summary?.suspicious_activities ?? 0, icon: <ExclamationTriangleIcon className="h-5 w-5" /> },
    { title: 'Pending compliance', value: summary?.pending_compliance_requests ?? 0, icon: <ClipboardDocumentCheckIcon className="h-5 w-5" /> },
    { title: 'Deletion requests', value: summary?.account_deletion_requests ?? 0, icon: <TrashIcon className="h-5 w-5" /> },
    { title: 'Password resets (24h)', value: summary?.recent_password_resets_24h ?? 0, icon: <KeyIcon className="h-5 w-5" /> },
  ];

  return (
    <>
      <PageHeader
        title="Security & Compliance"
        description="Centralized security operations — audit trails, sessions, compliance, and threat monitoring"
        actions={
          <button type="button" className="btn-outline text-sm" onClick={() => refetch()}>
            Refresh
          </button>
        }
      />
      <SecurityNav />
      <LiveSecurityWidgets />

      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((s) => (
            <StatsCard key={s.title} title={s.title} value={s.value} icon={s.icon} />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CriticalActionsList actions={data?.recent_critical_actions || []} />
        <AlertsList alerts={data?.live?.security_alerts || []} />
      </div>
    </>
  );
}

function CriticalActionsList({ actions }: { actions: ActivityLogRow[] }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-secondary-900">Recent critical actions</h3>
        <Link href="/security/logs?severity=critical" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      {actions.length === 0 ? (
        <EmptyState title="No critical actions" description="High-severity admin actions will appear here." />
      ) : (
        <ul className="divide-y divide-neutral-50">
          {actions.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-medium text-secondary-800">{formatActionLabel(a.action_type)}</p>
                <p className="text-xs text-neutral-400">
                  {a.admin?.name || 'System'} · {a.module} · {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertsList({ alerts }: { alerts: SecurityAlertRow[] }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-secondary-900">Security alerts</h3>
        <Link href="/security/monitoring" className="text-sm text-primary hover:underline">
          Monitor
        </Link>
      </div>
      {alerts.length === 0 ? (
        <EmptyState title="No open alerts" description="Suspicious activity alerts will appear here." />
      ) : (
        <ul className="divide-y divide-neutral-50">
          {alerts.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-secondary-800">{formatAlertType(a.alert_type)}</p>
                  <p className="text-xs text-neutral-400">{a.recommended_action || 'Review required'}</p>
                </div>
                <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
