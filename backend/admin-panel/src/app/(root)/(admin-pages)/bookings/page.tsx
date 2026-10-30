'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { bookingsService } from '@/services/bookings.service';
import { useTableState } from '@/hooks/useTableState';
import { useSocket } from '@/hooks/useSocket';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, StatsCard, Input, Button } from '@/components/ui';
import { BookingLiveView } from '@/components/bookings/BookingLiveView';
import { formatDate } from '@/utils/formatDate';
import type { Booking, BookingDashboardStats, TableColumn } from '@/types';
import {
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  BoltIcon,
  TagIcon,
  TableCellsIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

// ── Status helpers ──────────────────────────────────────────────────────────

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success',
  refunded: 'success',
  in_progress: 'primary',
  confirmed: 'primary',
  assigned: 'primary',
  pending_payment: 'warning',
  cancelled: 'danger',
  failed: 'danger',
  disputed: 'danger',
};

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending',
  confirmed: 'Confirmed',
  assigned: 'Provider Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

function getDisplayStatus(booking: Booking): string {
  if (booking.tracking_status) {
    const trackingLabels: Record<string, string> = {
      on_the_way: 'On The Way',
      arrived: 'Arrived',
      service_started: 'Service Started',
      service_completed: 'Service Completed',
    };
    if (trackingLabels[booking.tracking_status]) return trackingLabels[booking.tracking_status];
  }
  return statusLabel[booking.status] || booking.status.replace(/_/g, ' ');
}

// ── Quick status filter groups (table view) ─────────────────────────────────

interface QuickFilter {
  key: string;
  label: string;
  statuses: string[];
  statsKey: keyof BookingDashboardStats | null;
  includeAbandoned?: boolean;
  includeArchived?: boolean;
}

const QUICK_FILTERS: QuickFilter[] = [
  { key: 'all',       label: 'All',       statuses: [],                                  statsKey: null },
  { key: 'pending',   label: 'Pending',   statuses: ['pending_payment', 'confirmed'],    statsKey: 'pending' },
  { key: 'active',    label: 'Active',    statuses: ['assigned', 'in_progress'],         statsKey: 'active' },
  { key: 'completed', label: 'Completed', statuses: ['completed'],                       statsKey: 'completed' },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'refunded', 'failed'], statsKey: 'cancelled' },
  { key: 'disputed',  label: 'Disputed',  statuses: ['disputed'],                        statsKey: 'disputed' },
  { key: 'cleanup',   label: 'Cleanup',   statuses: ['pending_payment', 'failed', 'cancelled'], statsKey: null, includeAbandoned: true },
  { key: 'archived',  label: 'Archived',  statuses: [],                                  statsKey: null, includeArchived: true },
];

// ── Socket indicator (table view toolbar) ───────────────────────────────────

function SocketDot({ connected }: { connected: boolean }) {
  if (!connected) return null;
  return (
    <span className="relative flex h-2 w-2" title="Live socket connected">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'live';

export default function BookingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<string>('all');

  const {
    page, pageSize, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at', defaultSortDirection: 'desc' });

  // Derive status param from quick filter or the dropdown filter
  const activeQuickGroup = QUICK_FILTERS.find((g) => g.key === quickFilter) ?? QUICK_FILTERS[0];
  const statusParam = activeQuickGroup.statuses.length
    ? activeQuickGroup.statuses.join(',')
    : (filters.status || undefined);

  // Real-time stats
  const { data: stats } = useQuery({
    queryKey: ['booking-stats'],
    queryFn: () => bookingsService.getStats().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  // Bookings list (table view)
  const { data, isLoading } = useQuery({
    // Archived and All can share the same status filter, so the selected tab
    // must be part of the cache key to prevent reusing the normal booking list.
    queryKey: ['bookings', quickFilter, queryParams, statusParam, filters, dateFrom, dateTo, amountMin, amountMax, cityFilter],
    queryFn: () =>
      bookingsService.list({
        ...queryParams,
        status: statusParam,
        service_type: filters.service_type || undefined,
        payment_status: filters.payment_status || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        amount_min: amountMin ? parseFloat(amountMin) : undefined,
        amount_max: amountMax ? parseFloat(amountMax) : undefined,
        city: cityFilter || undefined,
        include_abandoned: activeQuickGroup.includeAbandoned ? true : undefined,
        include_archived: activeQuickGroup.includeArchived ? true : undefined,
      }).then((r) => r.data.data),
    enabled: viewMode === 'table',
  });

  // Real-time socket updates (table view)
  const handleSocketEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
  }, [queryClient]);

  const { connected } = useSocket({
    booking_created:           handleSocketEvent,
    booking_updated:           handleSocketEvent,
    booking_cancelled:         handleSocketEvent,
    refund_processed:          handleSocketEvent,
    provider_location_updated: handleSocketEvent,
  });

  const columns: TableColumn<Booking>[] = [
    {
      key: 'booking_code',
      label: 'Booking ID',
      sortable: true,
      render: (_, row) => (
        <span className="font-mono text-xs font-medium text-secondary-900">{row.booking_code || `#${row.id}`}</span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{row.user?.name || row.user?.email || '—'}</p>
          {row.user?.phone && <p className="text-xs text-neutral-300">{row.user.phone}</p>}
        </div>
      ),
    },
    {
      key: 'driver',
      label: 'Provider',
      render: (_, row) =>
        row.assigned_driver ? (
          <div>
            <p className="text-sm font-medium text-secondary-900">{row.assigned_driver.name || row.assigned_driver.email}</p>
          </div>
        ) : (
          <span className="text-xs text-neutral-200">Unassigned</span>
        ),
    },
    {
      key: 'service_type',
      label: 'Service',
      render: (_, row) => (
        <Badge variant="neutral">{row.service_type?.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (_, row) =>
        row.vehicle ? (
          <span className="text-sm text-secondary-700">
            {row.vehicle.make} {row.vehicle.model}
          </span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'scheduled_at',
      label: 'Scheduled',
      sortable: true,
      render: (_, row) => {
        const when = row.scheduled_at || row.service_datetime;
        return when ? (
          <span className="text-sm text-secondary-700">{formatDate(when, 'MMM d, h:mm a')}</span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {getDisplayStatus(row)}
        </Badge>
      ),
    },
    {
      key: 'total_price',
      label: 'Amount',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-semibold text-secondary-900">
          {row.total_price ? `$${parseFloat(row.total_price).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'address',
      label: 'Location',
      render: (_, row) =>
        row.address ? (
          <span className="max-w-[140px] truncate text-xs text-neutral-300" title={row.address}>
            {row.address}
          </span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatDate(row.created_at, 'MMM d, yyyy')}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Monitor and manage all bookings in real-time"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-neutral-100 bg-white p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-300 hover:text-secondary-700'
                }`}
              >
                <TableCellsIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('live')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'live'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-300 hover:text-secondary-700'
                }`}
              >
                <BoltIcon className="h-3.5 w-3.5" />
                Live
              </button>
            </div>

            <Link href="/bookings/charges">
              <Button variant="outline" size="sm">
                <TagIcon className="mr-2 h-4 w-4" />
                Charges
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <StatsCard
          title="Today"
          value={stats?.total_today ?? 0}
          icon={<CalendarDaysIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending"
          value={stats?.pending ?? 0}
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Active"
          value={stats?.active ?? 0}
          icon={<BoltIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Completed"
          value={stats?.completed ?? 0}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Cancelled"
          value={stats?.cancelled ?? 0}
          icon={<XCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Disputed"
          value={stats?.disputed ?? 0}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Revenue"
          value={stats ? `$${Number(stats.total_revenue).toFixed(0)}` : '$0'}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
      </div>

      {/* ── Live View ── */}
      {viewMode === 'live' && <BookingLiveView stats={stats} />}

      {/* ── Table View ── */}
      {viewMode === 'table' && (
        <div className="space-y-4">

          {/* Quick status filter tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((group) => {
              const count =
                group.statsKey && stats ? Number(stats[group.statsKey] ?? 0) : undefined;
              const isActive = quickFilter === group.key;
              return (
                <button
                  key={group.key}
                  onClick={() => { setQuickFilter(group.key); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-primary bg-primary text-white'
                      : 'border-neutral-100 bg-white text-neutral-300 hover:border-primary-200 hover:text-primary'
                  }`}
                >
                  {group.label}
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

            {/* Socket live indicator */}
            <div className="ml-auto flex items-center gap-1.5">
              <SocketDot connected={connected} />
              {connected && <span className="text-xs text-neutral-300">Live</span>}
            </div>
          </div>

          {/* Search & Filters */}
          <SearchFilter
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder="Search by booking ID, customer, provider, phone..."
            filters={[
              {
                key: 'status',
                label: 'All Statuses',
                value: filters.status || '',
                onChange: (v) => { handleFilter('status', v); setQuickFilter('all'); },
                options: [
                  { label: 'Pending', value: 'pending_payment' },
                  { label: 'Confirmed', value: 'confirmed' },
                  { label: 'Assigned', value: 'assigned' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'Failed', value: 'failed' },
                  { label: 'Disputed', value: 'disputed' },
                  { label: 'Refunded', value: 'refunded' },
                ],
              },
              {
                key: 'service_type',
                label: 'All Services',
                value: filters.service_type || '',
                onChange: (v) => handleFilter('service_type', v),
                options: [
                  { label: 'Car Wash', value: 'car_wash' },
                  { label: 'EV Charging', value: 'ev_charging' },
                  { label: 'Combo', value: 'combo' },
                ],
              },
              {
                key: 'payment_status',
                label: 'Payment Status',
                value: filters.payment_status || '',
                onChange: (v) => handleFilter('payment_status', v),
                options: [
                  { label: 'Succeeded', value: 'succeeded' },
                  { label: 'Processing', value: 'processing' },
                  { label: 'Failed', value: 'failed' },
                  { label: 'Cancelled', value: 'cancelled' },
                ],
              },
            ]}
            actions={
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-sm font-medium text-primary hover:text-primary-700"
              >
                {showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
              </button>
            }
          />

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                label="Service From"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              />
              <Input
                label="Service To"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              />
              <Input
                label="Min Amount"
                type="number"
                placeholder="$0"
                value={amountMin}
                onChange={(e) => { setAmountMin(e.target.value); setPage(1); }}
              />
              <Input
                label="Max Amount"
                type="number"
                placeholder="$999"
                value={amountMax}
                onChange={(e) => { setAmountMax(e.target.value); setPage(1); }}
              />
              <Input
                label="City / State"
                placeholder="e.g. New York"
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
              />
            </div>
          )}

          {/* Table */}
          <Table
            columns={columns}
            data={data?.rows ?? []}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(row) => router.push(`/bookings/${row.id}`)}
            isLoading={isLoading}
            emptyMessage="No bookings found"
            rowKey={(row) => row.id}
          />

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
            totalItems={data?.count}
            pageSize={pageSize}
          />
        </div>
      )}
    </>
  );
}
