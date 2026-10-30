'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { financeService } from '@/services/finance.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, StatsCard, Input } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import {
  ArrowPathIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatCurrency';

type RefundStatus = 'requested' | 'approved' | 'rejected' | 'processing' | 'refunded';

interface RefundRecord {
  id: number;
  booking_id: number | null;
  user_id: number;
  amount: string | null;
  reason: string | null;
  status: RefundStatus;
  stripe_refund_id: string | null;
  processed_at: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string; phone: string };
  booking_transaction?: {
    id: number;
    transaction_code: string;
    amount: string;
    status: string;
    booking?: {
      id: number;
      booking_code: string;
      service_type: string;
      status: string;
    };
  };
}

interface RefundListResponse {
  rows: RefundRecord[];
  count: number;
  totalPages: number;
  currentPage: number;
  stats: {
    total_requests: number;
    total_refunded: number;
    pending_amount: number;
  };
}

const statusVariant: Record<RefundStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  refunded: 'success',
  approved: 'primary',
  processing: 'primary',
  requested: 'warning',
  rejected: 'danger',
};

export default function RefundHistoryPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);

  const {
    page, pageSize, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  const { data, isLoading } = useQuery({
    queryKey: ['refund-history', queryParams, filters, dateFrom, dateTo],
    queryFn: () =>
      financeService.listRefundHistory({
        ...queryParams,
        status: filters.status || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
      }).then((r) => (r.data as { data: RefundListResponse }).data),
  });

  const stats = data?.stats;

  const columns: TableColumn<RefundRecord>[] = [
    {
      key: 'id',
      label: 'Refund #',
      render: (_, row) => (
        <span className="font-mono text-xs font-medium text-secondary-900">#{row.id}</span>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{row.user?.name || '—'}</p>
          <p className="text-xs text-neutral-300">{row.user?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'booking_transaction',
      label: 'Booking',
      render: (_, row) => {
        const booking = row.booking_transaction?.booking;
        return booking ? (
          <div>
            <button
              onClick={() => router.push(`/bookings/${booking.id}`)}
              className="font-mono text-xs font-medium text-primary hover:underline"
            >
              {booking.booking_code}
            </button>
            <p className="text-xs text-neutral-300 capitalize">{booking.service_type?.replace(/_/g, ' ')}</p>
          </div>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        );
      },
    },
    {
      key: 'amount',
      label: 'Refund Amount',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-semibold text-secondary-900">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (_, row) => (
        <span className="max-w-[200px] truncate text-sm text-secondary-700" title={row.reason || ''}>
          {row.reason || '—'}
        </span>
      ),
    },
    {
      key: 'stripe_refund_id',
      label: 'Stripe Refund ID',
      render: (_, row) => (
        <span className="font-mono text-xs text-neutral-300">{row.stripe_refund_id || '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'processed_at',
      label: 'Processed At',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-neutral-300">
          {row.processed_at ? formatDate(row.processed_at, 'MMM d, yyyy h:mm a') : '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Requested At',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatDate(row.created_at, 'MMM d, yyyy')}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Refund History"
        description="View all refund requests, processed refunds, and refund amounts"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Requests"
          value={stats?.total_requests ?? 0}
          icon={<ArrowPathIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Refunded"
          value={formatCurrency(stats?.total_refunded ?? 0)}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending Refunds"
          value={formatCurrency(stats?.pending_amount ?? 0)}
          icon={<ClockIcon className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by customer name, email, refund ID..."
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Requested', value: 'requested' },
                { label: 'Approved', value: 'approved' },
                { label: 'Processing', value: 'processing' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Rejected', value: 'rejected' },
              ],
            },
          ]}
          actions={
            <button
              onClick={() => setShowDateFilters(!showDateFilters)}
              className="text-sm font-medium text-primary hover:text-primary-700"
            >
              {showDateFilters ? 'Hide Dates' : 'Filter by Date'}
            </button>
          }
        />

        {showDateFilters && (
          <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        )}

        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          isLoading={isLoading}
          emptyMessage="No refund records found"
          rowKey={(row) => row.id}
        />

        <Pagination
          currentPage={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          totalItems={data?.count}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
