'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bookingsService } from '@/services/bookings.service';
import { useTableState } from '@/hooks/useTableState';
import { useSocket } from '@/hooks/useSocket';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge, Button, Input, Modal, Pagination, StatsCard, Table } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';
import type { BookingDispute, BookingDisputeStats, TableColumn } from '@/types';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';

// ── Helpers ─────────────────────────────────────────────────────────────────

const statusVariant: Record<string, 'danger' | 'warning' | 'success' | 'neutral'> = {
  open: 'danger',
  investigating: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DisputesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { page, pageSize, queryParams, setPage } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Resolve modal state
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<BookingDispute | null>(null);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [resolveNotes, setResolveNotes] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ['dispute-stats'],
    queryFn: () => bookingsService.getDisputeStats().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', statusFilter, search, fromDate, toDate, page, pageSize],
    queryFn: () =>
      bookingsService
        .listDisputes({
          page,
          limit: pageSize,
          status: statusFilter || undefined,
          search: search || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        })
        .then((r) => r.data.data),
  });

  // Realtime refresh
  const handleSocketEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['disputes'] });
    queryClient.invalidateQueries({ queryKey: ['dispute-stats'] });
  }, [queryClient]);

  useSocket({
    booking_updated: handleSocketEvent,
    booking_cancelled: handleSocketEvent,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const resolveMutation = useMutation({
    mutationFn: () =>
      bookingsService.resolveDispute(resolveTarget!.id, {
        status: resolveStatus,
        admin_notes: resolveNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Dispute updated');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-stats'] });
      setResolveOpen(false);
      setResolveNotes('');
      setResolveTarget(null);
    },
    onError: () => toast.error('Failed to update dispute'),
  });

  function openResolve(dispute: BookingDispute) {
    setResolveTarget(dispute);
    setResolveStatus(dispute.status === 'open' ? 'investigating' : 'resolved');
    setResolveNotes(dispute.admin_notes || '');
    setResolveOpen(true);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: TableColumn<BookingDispute>[] = [
    {
      key: 'id',
      label: 'Dispute ID',
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-secondary-900">#{row.id}</span>
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      render: (_, row) => {
        const b = row.booking;
        if (!b) return <span className="text-xs text-neutral-200">—</span>;
        return (
          <Link
            href={`/bookings/${b.id}`}
            onClick={(e) => e.stopPropagation()}
            className="group inline-flex items-center gap-1 font-mono text-xs font-medium text-primary hover:text-primary-700"
          >
            {b.booking_code || `#${b.id}`}
            <ArrowTopRightOnSquareIcon className="h-3 w-3 opacity-0 group-hover:opacity-100" />
          </Link>
        );
      },
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, row) => {
        const u = row.booking?.user;
        if (!u) return <span className="text-xs text-neutral-200">—</span>;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-secondary-900">{u.name || u.email}</p>
            {u.name && <p className="truncate text-xs text-neutral-300">{u.email}</p>}
          </div>
        );
      },
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (_, row) => {
        const d = row.booking?.assigned_driver;
        if (!d) return <span className="text-xs text-neutral-200">Unassigned</span>;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-secondary-900">{d.name || d.email}</p>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'customer_complaint',
      label: 'Complaint',
      render: (_, row) =>
        row.customer_complaint ? (
          <p className="max-w-[220px] truncate text-xs text-neutral-300" title={row.customer_complaint}>
            {row.customer_complaint}
          </p>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Opened',
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatDate(row.created_at, 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'resolved_at',
      label: 'Resolved',
      render: (_, row) =>
        row.resolved_at ? (
          <span className="text-xs text-neutral-300">{formatDate(row.resolved_at, 'MMM d, yyyy')}</span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'resolver',
      label: 'Resolved by',
      render: (_, row) =>
        row.resolver ? (
          <span className="text-xs text-secondary-700">{row.resolver.name}</span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {['open', 'investigating'].includes(row.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openResolve(row)}
            >
              Resolve
            </Button>
          )}
          {row.booking && (
            <Link href={`/bookings/${row.booking.id}`}>
              <Button variant="ghost" size="sm" icon={<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />}>
                Booking
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  const statCounts: { label: string; value: number; icon: React.ReactNode; variant?: string }[] = [
    {
      label: 'Open',
      value: stats?.open ?? 0,
      icon: <ExclamationTriangleIcon className="h-5 w-5" />,
    },
    {
      label: 'Investigating',
      value: stats?.investigating ?? 0,
      icon: <MagnifyingGlassIcon className="h-5 w-5" />,
    },
    {
      label: 'Resolved',
      value: stats?.resolved ?? 0,
      icon: <CheckCircleIcon className="h-5 w-5" />,
    },
    {
      label: 'Closed',
      value: stats?.closed ?? 0,
      icon: <XCircleIcon className="h-5 w-5" />,
    },
    {
      label: 'Avg. resolution',
      value: stats?.avg_resolution_hours != null ? stats.avg_resolution_hours : 0,
      icon: <ClockIcon className="h-5 w-5" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Disputes & Complaints"
        description="Review, investigate, and resolve booking disputes"
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCounts.map((s, i) => (
          <StatsCard
            key={s.label}
            title={s.label}
            value={i === 4 && s.value ? `${s.value}h` : s.value}
            icon={s.icon}
          />
        ))}
      </div>

      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.key === '' ? stats?.total :
            f.key === 'open' ? stats?.open :
            f.key === 'investigating' ? stats?.investigating :
            f.key === 'resolved' ? stats?.resolved :
            f.key === 'closed' ? stats?.closed : undefined;

          const isActive = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-neutral-100 bg-white text-neutral-300 hover:border-primary-200 hover:text-primary'
              }`}
            >
              {f.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Search + date filter on the right */}
        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-300" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search booking, customer, provider…"
                className="input h-8 w-72 pl-8 text-xs"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
          <button
            onClick={() => setShowDateFilter((v) => !v)}
            className="text-xs font-medium text-primary hover:text-primary-700"
          >
            {showDateFilter ? 'Hide dates' : 'Date range'}
          </button>
        </div>
      </div>

      {/* Date range */}
      {showDateFilter && (
        <div className="card mb-4 flex flex-wrap items-end gap-4">
          <Input
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          />
          <Input
            label="To"
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          />
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        emptyMessage="No disputes found"
        rowKey={(row) => row.id}
        onRowClick={(row) => row.booking && router.push(`/bookings/${row.booking.id}?tab=disputes`)}
      />

      {/* Pagination */}
      <div className="mt-4">
        <Pagination
          currentPage={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          totalItems={data?.count}
          pageSize={pageSize}
        />
      </div>

      {/* Link to support tickets note */}
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
        <TicketIcon className="h-4 w-4 shrink-0 text-neutral-300" />
        <p className="text-xs text-neutral-300">
          Support tickets linked to disputed bookings are accessible from the{' '}
          <Link href="/support/tickets" className="font-medium text-primary hover:text-primary-700">
            Support → Tickets
          </Link>{' '}
          section. Use the booking code to search for related tickets.
        </p>
      </div>

      {/* Resolve Modal */}
      <Modal
        open={resolveOpen}
        onClose={() => { setResolveOpen(false); setResolveNotes(''); setResolveTarget(null); }}
        title={`Resolve Dispute #${resolveTarget?.id ?? ''}`}
        size="sm"
      >
        {resolveTarget && (
          <div className="space-y-4">
            {/* Context */}
            <div className="rounded-lg bg-neutral-50 p-3 text-xs space-y-1">
              {resolveTarget.booking && (
                <p>
                  <span className="text-neutral-300">Booking: </span>
                  <Link
                    href={`/bookings/${resolveTarget.booking.id}`}
                    className="font-medium text-primary hover:text-primary-700"
                    onClick={() => setResolveOpen(false)}
                  >
                    {resolveTarget.booking.booking_code || `#${resolveTarget.booking.id}`}
                  </Link>
                </p>
              )}
              {resolveTarget.customer_complaint && (
                <p>
                  <span className="text-neutral-300">Complaint: </span>
                  <span className="text-secondary-700">{resolveTarget.customer_complaint}</span>
                </p>
              )}
              {resolveTarget.provider_response && (
                <p>
                  <span className="text-neutral-300">Provider response: </span>
                  <span className="text-secondary-700">{resolveTarget.provider_response}</span>
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Update status
              </label>
              <select
                className="input w-full"
                value={resolveStatus}
                onChange={(e) => setResolveStatus(e.target.value)}
              >
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <Input
              label="Admin notes"
              placeholder="Add resolution notes…"
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResolveOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate()}
              >
                Update Dispute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
