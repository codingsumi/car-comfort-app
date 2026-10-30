'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, Modal, Pagination, Table, StatsCard } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import type { PlatformReportRow, PlatformReportDetailResponse } from '@/types/contentModeration';
import { SupportNav } from '@/components/support/SupportNav';
import toast from 'react-hot-toast';
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/formatDate';

const CATEGORIES = [
  { label: 'Inappropriate behavior', value: 'inappropriate_behavior' },
  { label: 'Poor service quality', value: 'poor_service_quality' },
  { label: 'Fraud/scam', value: 'fraud_scam' },
  { label: 'Offensive communication', value: 'offensive_communication' },
  { label: 'Fake reviews', value: 'fake_reviews' },
  { label: 'Payment dispute', value: 'payment_dispute' },
  { label: 'Safety issue', value: 'safety_issue' },
  { label: 'Vehicle damage', value: 'vehicle_damage' },
  { label: 'Missing item', value: 'missing_item' },
  { label: 'Spam/abuse', value: 'spam_abuse' },
];

function priorityVariant(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'neutral';
  return 'success';
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' {
  switch (s) {
    case 'open': return 'warning';
    case 'under_review': return 'primary';
    case 'investigating': return 'primary';
    case 'escalated': return 'danger';
    case 'resolved': return 'success';
    case 'dismissed': return 'neutral';
    default: return 'neutral';
  }
}

const STATUS_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Investigating', value: 'investigating' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

export default function ReportedIssuesPage() {
  const qc = useQueryClient();
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const [active, setActive] = useState<PlatformReportDetailResponse | null>(null);
  const [note, setNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [newStatus, setNewStatus] = useState('investigating');

  const params = {
    ...queryParams,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    report_type: filters.report_type || undefined,
    user_type: filters.user_type || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['reported-issues', params, page],
    queryFn: () => contentModerationService.listReports({ ...params, page }).then((r) => r.data.data),
  });

  // Stats from paginated data
  const reports = data?.reports ?? [];
  const totalOpen = reports.filter((r) => r.status === 'open').length;
  const totalEscalated = reports.filter((r) => r.status === 'escalated').length;
  const totalResolved = reports.filter((r) => r.status === 'resolved').length;

  const noteMut = useMutation({
    mutationFn: () =>
      contentModerationService.addReportNote(active!.report.id, { note, is_internal: true }),
    onSuccess: () => {
      toast.success('Investigation note added');
      setNote('');
      qc.invalidateQueries({ queryKey: ['reported-issues'] });
      contentModerationService
        .getReport(active!.report.id)
        .then((r) => setActive(r.data.data as PlatformReportDetailResponse));
    },
  });

  const statusMut = useMutation({
    mutationFn: () =>
      contentModerationService.updateReport(active!.report.id, {
        status: newStatus,
        resolution_notes: resolutionNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Issue status updated');
      qc.invalidateQueries({ queryKey: ['reported-issues'] });
      setActive(null);
      setResolutionNotes('');
    },
  });

  const openDetail = async (row: PlatformReportRow) => {
    const res = await contentModerationService.getReport(row.id);
    const detail = res.data.data as PlatformReportDetailResponse;
    setActive(detail);
    setNewStatus(detail.report.status || 'investigating');
    setResolutionNotes('');
    setNote('');
  };

  const cols: TableColumn<PlatformReportRow>[] = [
    {
      key: 'id',
      label: '#',
      render: (_, r) => <span className="font-mono text-xs text-neutral-400">#{r.id}</span>,
    },
    {
      key: 'reporter',
      label: 'Reported By',
      render: (_, r) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{r.reporter?.name || '—'}</p>
          <p className="text-xs text-neutral-400 capitalize">{(r as PlatformReportRow & { user_type?: string }).user_type || 'customer'}</p>
        </div>
      ),
    },
    {
      key: 'target',
      label: 'Against',
      render: (_, r) => (
        <span className="text-sm text-secondary-700">{r.target?.name || '—'}</span>
      ),
    },
    {
      key: 'report_type',
      label: 'Category',
      render: (_, r) => (
        <span className="text-xs text-secondary-700 capitalize">
          {r.report_type?.replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (_, r) => (
        <Badge variant={priorityVariant(r.priority)} dot>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, r) => (
        <Badge variant={statusVariant(r.status)} dot>
          {r.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (_, r) => (
        <span className="text-xs text-neutral-400">{formatDate(r.created_at, 'MMM d, yyyy')}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reported Issues"
        description="View and manage issues reported by customers and service providers"
      />
      <SupportNav />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Total Reports"
          value={data?.pagination?.total ?? 0}
          icon={<ShieldExclamationIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Open"
          value={totalOpen}
          icon={<ClockIcon className="h-5 w-5" />}
          changeType={totalOpen > 0 ? 'negative' : 'neutral'}
        />
        <StatsCard
          title="Escalated"
          value={totalEscalated}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          changeType={totalEscalated > 0 ? 'negative' : 'neutral'}
        />
        <StatsCard
          title="Resolved"
          value={totalResolved}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          changeType={totalResolved > 0 ? 'positive' : 'neutral'}
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name or description..."
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: STATUS_OPTIONS,
            },
            {
              key: 'priority',
              label: 'All Priorities',
              value: filters.priority || '',
              onChange: (v) => handleFilter('priority', v),
              options: [
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
              ],
            },
            {
              key: 'report_type',
              label: 'All Categories',
              value: filters.report_type || '',
              onChange: (v) => handleFilter('report_type', v),
              options: CATEGORIES,
            },
            {
              key: 'user_type',
              label: 'All Users',
              value: filters.user_type || '',
              onChange: (v) => handleFilter('user_type', v),
              options: [
                { label: 'Customers', value: 'customer' },
                { label: 'Providers', value: 'driver' },
              ],
            },
          ]}
        />
      </div>

      <div className="card p-0">
        <Table
          columns={cols}
          data={data?.reports ?? []}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={openDetail}
          emptyMessage="No reported issues found"
        />
        <div className="border-t border-neutral-50 p-3">
          <Pagination
            currentPage={page}
            totalPages={data?.pagination?.total_pages ?? 1}
            onPageChange={setPage}
            totalItems={data?.pagination?.total}
          />
        </div>
      </div>

      {/* Issue Detail Modal */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Issue #${active.report.id} — ${active.report.report_type?.replace(/_/g, ' ')}` : ''}
        size="lg"
      >
        {active && (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-neutral-400">Reported By</p>
                <p className="font-medium text-secondary-900">{active.report.reporter?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Against</p>
                <p className="font-medium text-secondary-900">{active.report.target?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Priority</p>
                <Badge variant={priorityVariant(active.report.priority)} dot>
                  {active.report.priority}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Current Status</p>
                <Badge variant={statusVariant(active.report.status)} dot>
                  {active.report.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Description</p>
              <p className="whitespace-pre-wrap rounded-lg border border-neutral-100 p-3 text-secondary-700">
                {active.report.description || '—'}
              </p>
            </div>

            {/* Booking link */}
            {active.report.booking && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <FlagIcon className="h-4 w-4" />
                <span>Related Booking: <strong className="text-primary">{active.report.booking.booking_code}</strong></span>
              </div>
            )}

            {/* Investigation timeline */}
            {((active.report.notes?.length ?? 0) > 0 || (active.audit_timeline?.length ?? 0) > 0) && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Investigation Timeline</p>
                <ul className="space-y-2 border-l-2 border-neutral-100 pl-4">
                  {(active.report.notes || []).map((n) => (
                    <li key={n.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-white" />
                      <p className="text-xs text-neutral-400">
                        <span className="font-medium text-secondary-700">{n.admin?.name || 'Admin'}</span>
                        {' · '}{formatDate(n.created_at, 'MMM d, yyyy h:mm a')}
                      </p>
                      <p className="mt-0.5 text-secondary-600">{n.note}</p>
                    </li>
                  ))}
                  {(active.audit_timeline || []).map((a) => (
                    <li key={`a-${a.id}`} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-200 bg-white" />
                      <p className="text-xs text-neutral-400">
                        {a.action_type?.replace(/_/g, ' ')} · {formatDate(a.created_at, 'MMM d, yyyy h:mm a')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add investigation note */}
            <div className="space-y-2 rounded-lg border border-neutral-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Add Investigation Note</p>
              <textarea
                className="input w-full"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Document your findings..."
              />
              <Button size="sm" onClick={() => noteMut.mutate()} loading={noteMut.isPending} disabled={!note.trim()}>
                Save Note
              </Button>
            </div>

            {/* Update status */}
            <div className="rounded-lg border border-neutral-100 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Update Status</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">Resolution Notes (optional)</label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe the resolution or outcome..."
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">New Status</label>
                    <select
                      className="input text-sm"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => statusMut.mutate()} loading={statusMut.isPending}>
                    Update Status
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      contentModerationService
                        .updateReport(active.report.id, { escalate: true })
                        .then(() => {
                          toast.success('Issue escalated');
                          qc.invalidateQueries({ queryKey: ['reported-issues'] });
                          setActive(null);
                        })
                    }
                  >
                    Escalate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
