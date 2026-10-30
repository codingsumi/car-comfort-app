'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, StatsCard, Badge, Input } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { SupportNav } from '@/components/support/SupportNav';
import { contentModerationService } from '@/services/contentModeration.service';
import { formatDate } from '@/utils/formatDate';
import { EnvelopeIcon, UserGroupIcon, TruckIcon } from '@heroicons/react/24/outline';

interface EmailRecord {
  id: number;
  to_email: string;
  to_name: string;
  subject: string;
  ticket_id: number | null;
  sent_by: { id: number; name: string } | null;
  ip_address: string | null;
  created_at: string;
}

interface EmailHistoryResponse {
  rows: EmailRecord[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export default function EmailHistoryPage() {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);

  const {
    page, pageSize, search, filters, queryParams,
    setPage, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  const { data, isLoading } = useQuery({
    queryKey: ['email-history', queryParams, filters, dateFrom, dateTo],
    queryFn: () =>
      contentModerationService.listEmailHistory({
        ...queryParams,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        ticket_id: filters.ticket_id || undefined,
      }).then((r) => (r.data as { data: EmailHistoryResponse }).data),
  });

  const columns: TableColumn<EmailRecord>[] = [
    {
      key: 'to_email',
      label: 'Recipient',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{row.to_name || row.to_email}</p>
          <p className="text-xs text-neutral-400">{row.to_email}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (_, row) => (
        <span className="text-sm text-secondary-700 line-clamp-1">{row.subject || '—'}</span>
      ),
    },
    {
      key: 'ticket_id',
      label: 'Ticket',
      render: (_, row) =>
        row.ticket_id ? (
          <button
            onClick={() => router.push(`/support/tickets/${row.ticket_id}`)}
            className="text-xs font-medium text-primary hover:underline"
          >
            #{row.ticket_id}
          </button>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        ),
    },
    {
      key: 'sent_by',
      label: 'Sent By',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{row.sent_by?.name || '—'}</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (_, row) => (
        <span className="font-mono text-xs text-neutral-400">{row.ip_address || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Sent At',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-neutral-400">{formatDate(row.created_at, 'MMM d, yyyy h:mm a')}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Email History"
        description="All support emails sent to customers and service providers from the admin panel"
      />
      <SupportNav />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Emails Sent"
          value={data?.count ?? 0}
          icon={<EnvelopeIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Customers Contacted"
          value="—"
          icon={<UserGroupIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Providers Contacted"
          value="—"
          icon={<TruckIcon className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by recipient email, name, or subject..."
          filters={[]}
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
          isLoading={isLoading}
          emptyMessage="No emails sent yet. Use the 'Email Customer' button on a support ticket to send emails."
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
