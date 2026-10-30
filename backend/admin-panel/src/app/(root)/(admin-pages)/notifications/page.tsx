'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { StatsCard, Badge, Button, Table } from '@/components/ui';
import { notificationManagementService } from '@/services/notificationManagement.service';
import type { TableColumn } from '@/types';
import type {
  NotificationCampaign,
  NotificationDeliveryLog,
} from '@/types/notificationManagement';
import {
  BellAlertIcon,
  PaperAirplaneIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ChartBarIcon,
  EnvelopeIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/formatDate';

const statusVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  scheduled: 'warning',
  sending: 'primary',
  sent: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

const campaignCols: TableColumn<NotificationCampaign>[] = [
  { key: 'campaign_name', label: 'Campaign' },
  {
    key: 'notification_type',
    label: 'Type',
    render: (_, r) => <Badge variant="neutral">{r.notification_type}</Badge>,
  },
  {
    key: 'delivery_stats',
    label: 'Audience',
    render: (_, r) => r.delivery_stats?.audience_size ?? '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (_, r) => <Badge variant={statusVariant[r.status] || 'neutral'}>{r.status}</Badge>,
  },
  {
    key: 'scheduled_at',
    label: 'Scheduled',
    render: (_, r) => (r.scheduled_at ? formatDate(r.scheduled_at, 'MMM d, h:mm a') : '—'),
  },
  {
    key: 'creator',
    label: 'Created by',
    render: (_, r) => r.creator?.name || '—',
  },
];

export default function NotificationDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-dashboard'],
    queryFn: () => notificationManagementService.getDashboard(),
  });

  const summary = data?.summary;

  return (
    <>
      <PageHeader
        title="Notification Management"
        description="Push, email, and in-app campaigns across customers and providers"
        actions={
          <Link href="/notifications/create">
            <Button size="sm">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              Create notification
            </Button>
          </Link>
        }
      />

      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Sent today" value={summary?.sentToday ?? 0} icon={<PaperAirplaneIcon className="h-5 w-5" />} />
        <StatsCard title="Push delivery rate" value={`${summary?.pushDeliveryRate ?? 0}%`} icon={<ChartBarIcon className="h-5 w-5" />} />
        <StatsCard title="Open rate" value={`${summary?.openRate ?? 0}%`} icon={<EyeIcon className="h-5 w-5" />} />
        <StatsCard title="Failed today" value={summary?.failedToday ?? 0} icon={<ExclamationTriangleIcon className="h-5 w-5" />} />
        <StatsCard title="Scheduled" value={summary?.scheduledCampaigns ?? 0} icon={<CalendarIcon className="h-5 w-5" />} />
        <StatsCard title="Active campaigns" value={summary?.activeCampaigns ?? 0} icon={<BellAlertIcon className="h-5 w-5" />} />
        <StatsCard title="Email success" value={`${summary?.emailSuccessRate ?? 0}%`} icon={<EnvelopeIcon className="h-5 w-5" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-secondary-900">Recent campaigns</h2>
            <Link href="/notifications/campaigns" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <Table
            columns={campaignCols}
            data={data?.recentCampaigns ?? []}
            isLoading={isLoading}
            emptyMessage="No campaigns yet"
            rowKey={(r) => r.id}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-secondary-900">Scheduled notifications</h2>
          <div className="space-y-2">
            {(data?.scheduledNotifications ?? []).length === 0 && !isLoading ? (
              <p className="text-sm text-neutral-400">No scheduled campaigns</p>
            ) : (
              (data?.scheduledNotifications ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-secondary-800">{c.campaign_name}</p>
                    <p className="text-xs text-neutral-400">
                      {c.scheduled_at ? formatDate(c.scheduled_at, 'MMM d, yyyy · h:mm a') : '—'}
                    </p>
                  </div>
                  <Badge variant="warning">scheduled</Badge>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-secondary-900">Failed deliveries</h2>
          <div className="space-y-2">
            {(data?.failedDeliveries ?? []).map((log: NotificationDeliveryLog) => (
              <div key={log.id} className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-3">
                <p className="text-sm font-medium text-secondary-800">{log.recipient?.name || log.recipient?.email}</p>
                <p className="text-xs text-danger line-clamp-1">{log.failure_reason || 'Delivery failed'}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-secondary-900">Recently opened</h2>
          <div className="space-y-2">
            {(data?.recentlyOpened ?? []).map((log: NotificationDeliveryLog) => (
              <div key={log.id} className="rounded-lg border border-neutral-100 bg-white px-4 py-3">
                <p className="text-sm font-medium text-secondary-800">{log.recipient?.name}</p>
                <p className="text-xs text-neutral-400">
                  {log.opened_at ? formatDate(log.opened_at, 'MMM d, h:mm a') : '—'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
