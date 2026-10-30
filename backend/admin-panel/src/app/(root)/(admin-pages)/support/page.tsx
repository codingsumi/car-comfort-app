'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  TruckIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { supportService } from '@/services/support.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Badge, EmptyState } from '@/components/ui';
import { SupportNav } from '@/components/support/SupportNav';
import { LiveSupportWidgets } from '@/components/support/LiveSupportWidgets';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatCategoryLabel, formatDurationHours, priorityVariant, statusVariant } from '@/components/support/formatters';
import type { SupportTicketRow } from '@/types/support';

export default function SupportDashboardPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['support-dashboard', queryParams],
    queryFn: () => supportService.getDashboard(queryParams).then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const summary = data?.summary;

  const statCards = [
    { title: 'Open tickets', value: summary?.open_tickets ?? 0, icon: <TicketIcon className="h-5 w-5" /> },
    { title: 'Pending responses', value: summary?.pending_responses ?? 0, icon: <ClockIcon className="h-5 w-5" /> },
    { title: 'Resolved', value: summary?.resolved_tickets ?? 0, icon: <CheckCircleIcon className="h-5 w-5" /> },
    { title: 'Escalated', value: summary?.escalated_tickets ?? 0, icon: <ArrowTrendingUpIcon className="h-5 w-5" /> },
    {
      title: 'Avg resolution',
      value: formatDurationHours(summary?.average_resolution_hours ?? 0),
      icon: <ClockIcon className="h-5 w-5" />,
    },
    { title: 'Customer complaints', value: summary?.customer_complaints ?? 0, icon: <UserGroupIcon className="h-5 w-5" /> },
    { title: 'Provider complaints', value: summary?.provider_complaints ?? 0, icon: <TruckIcon className="h-5 w-5" /> },
    {
      title: 'Top category',
      value: formatCategoryLabel(summary?.top_issue_category || 'general'),
      icon: <TagIcon className="h-5 w-5" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Support & Communication"
        description="Centralized support operations — tickets, escalations, and customer communications"
        actions={
          <button type="button" className="btn-outline text-sm" onClick={() => refetch()}>
            Refresh
          </button>
        }
      />
      <SupportNav />
      <LiveSupportWidgets />
      <DateRangeControls
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={setPeriod}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
        <RecentTicketsList title="Recent tickets" tickets={data?.recent_tickets || []} />
        <RecentTicketsList title="High priority" tickets={data?.live?.high_priority_cases || []} emptyLabel="No high-priority cases" />
      </div>
    </>
  );
}

function RecentTicketsList({
  title,
  tickets,
  emptyLabel = 'No tickets yet',
}: {
  title: string;
  tickets: SupportTicketRow[];
  emptyLabel?: string;
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-secondary-800">{title}</h3>
        <Link href="/support/tickets" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </div>
      {!tickets.length ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <ul className="divide-y divide-neutral-50">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/tickets/${t.id}`}
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-neutral-50/80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-secondary-800">{t.subject}</p>
                  <p className="text-xs text-neutral-300">
                    {t.ticket_number} · {t.requester?.name || 'Unknown'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                  <Badge variant={statusVariant(t.status)}>{t.status.replace(/_/g, ' ')}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

