'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Badge, Button, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { contentModerationService } from '@/services/contentModeration.service';
import type {
  ModerationDashboardData,
  PlatformReportRow,
  SupportTicketRow,
  ModerationLogRow,
} from '@/types/contentModeration';
import type { ModerationReview } from '@/types/providerPerformance';
import {
  ShieldExclamationIcon,
  ChatBubbleLeftRightIcon,
  FlagIcon,
  TicketIcon,
  TrashIcon,
  NoSymbolIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const reportCols: TableColumn<PlatformReportRow>[] = [
  { key: 'id', label: 'ID' },
    { key: 'reporter', label: 'Reporter', render: (_, r) => r.reporter?.name || '—' },
    { key: 'target', label: 'Target', render: (_, r) => r.target?.name || '—' },
    { key: 'report_type', label: 'Category' },
    { key: 'priority', label: 'Priority', render: (_, r) => <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge> },
    { key: 'status', label: 'Status', render: (_, r) => <Badge variant="neutral">{r.status}</Badge> },
];

const ticketCols: TableColumn<SupportTicketRow>[] = [
  { key: 'ticket_number', label: 'Ticket' },
    { key: 'requester', label: 'Sender', render: (_, r) => r.requester?.name || '—' },
  { key: 'user_type', label: 'Type' },
  { key: 'subject', label: 'Subject' },
    { key: 'last_message_preview', label: 'Last message', render: (_, r) => (r.last_message_preview || '').slice(0, 60) },
    { key: 'status', label: 'Status', render: (_, r) => <Badge variant="neutral">{r.status}</Badge> },
];

const logCols: TableColumn<ModerationLogRow>[] = [
    { key: 'created_at', label: 'When', render: (_, r) => new Date(r.created_at).toLocaleString() },
    { key: 'moderator', label: 'Admin', render: (_, r) => r.moderator?.name || '—' },
  { key: 'action_type', label: 'Action' },
  { key: 'target_entity', label: 'Entity' },
  { key: 'ip_address', label: 'IP' },
];

const flaggedCols: TableColumn<ModerationReview>[] = [
    { key: 'reviewer', label: 'Customer', render: (_, r) => r.reviewer?.name || '—' },
    { key: 'reviewee', label: 'Provider', render: (_, r) => r.reviewee?.name || '—' },
  { key: 'rating', label: 'Rating' },
    { key: 'flags_count', label: 'Flags', render: (_, r) => r.flags_count ?? 0 },
    { key: 'moderation_status', label: 'Status', render: (_, r) => <Badge variant="primary">{r.moderation_status}</Badge> },
];

function priorityVariant(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'neutral';
  return 'success';
}

export default function ContentModerationDashboardPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['moderation-dashboard', dateFrom, dateTo],
    queryFn: () =>
      contentModerationService
        .getDashboard({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
        .then((r) => r.data.data as ModerationDashboardData),
  });

  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="Moderation dashboard"
        description="Overview of reviews, reports, support load, and recent moderation activity."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-100 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-300">Date from</label>
          <input type="date" className="input text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-300">Date to</label>
          <input type="date" className="input text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => refetch()}>
          Apply
        </Button>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <Link href="/content-moderation/reviews" className="text-primary hover:underline">
            Reviews
          </Link>
          <span className="text-neutral-200">|</span>
          <Link href="/content-moderation/reports" className="text-primary hover:underline">
            Reports
          </Link>
          <span className="text-neutral-200">|</span>
          <Link href="/content-moderation/support" className="text-primary hover:underline">
            Support
          </Link>
          <span className="text-neutral-200">|</span>
          <Link href="/content-moderation/logs" className="text-primary hover:underline">
            Logs
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatsCard title="Pending reviews" value={s?.pending_reviews ?? 0} icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />} />
        <StatsCard title="Flagged reviews" value={s?.flagged_reviews ?? 0} icon={<FlagIcon className="h-5 w-5" />} />
        <StatsCard title="Open reports" value={s?.reported_issues ?? 0} icon={<ShieldExclamationIcon className="h-5 w-5" />} />
        <StatsCard title="Open tickets" value={s?.open_support_tickets ?? 0} icon={<TicketIcon className="h-5 w-5" />} />
        <StatsCard title="Removed reviews" value={s?.removed_content_count ?? 0} icon={<TrashIcon className="h-5 w-5" />} />
        <StatsCard title="Abuse/spam reports" value={s?.abuse_spam_reports ?? 0} icon={<NoSymbolIcon className="h-5 w-5" />} />
        <StatsCard title="Actions today" value={s?.moderation_actions_today ?? 0} icon={<BoltIcon className="h-5 w-5" />} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-neutral-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-secondary-900">Flagged reviews</h2>
            <Link href="/content-moderation/reviews" className="text-xs font-medium text-primary hover:underline">
              Open queue
            </Link>
          </div>
          <Table
            columns={flaggedCols}
            data={data?.recent_flagged_reviews || []}
            isLoading={isLoading}
            emptyMessage="No flagged reviews"
            rowKey={(r) => r.id}
          />
        </div>
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-neutral-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-secondary-900">Recent reports</h2>
            <Link href="/content-moderation/reports" className="text-xs font-medium text-primary hover:underline">
              All reports
            </Link>
          </div>
          <Table columns={reportCols} data={data?.recent_reports || []} isLoading={isLoading} emptyMessage="No reports" rowKey={(r) => r.id} />
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-neutral-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-secondary-900">Open support tickets</h2>
            <Link href="/content-moderation/support" className="text-xs font-medium text-primary hover:underline">
              Inbox
            </Link>
          </div>
          <Table columns={ticketCols} data={data?.recent_support_tickets || []} isLoading={isLoading} emptyMessage="No tickets" rowKey={(r) => r.id} />
        </div>
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-neutral-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-secondary-900">Recent moderation actions</h2>
            <Link href="/content-moderation/logs" className="text-xs font-medium text-primary hover:underline">
              Full log
            </Link>
          </div>
          <Table columns={logCols} data={data?.recent_moderation_actions || []} isLoading={isLoading} emptyMessage="No actions" rowKey={(r) => r.id} />
        </div>
      </div>
    </>
  );
}
