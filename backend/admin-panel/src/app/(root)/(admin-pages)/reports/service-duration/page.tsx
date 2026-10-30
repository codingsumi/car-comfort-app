'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { bookingsService } from '@/services/bookings.service';
import { providersService } from '@/services/providers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Button } from '@/components/ui';
import { formatDate, formatDurationMinutes } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import { useTableState } from '@/hooks/useTableState';
import { ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import type { TableColumn } from '@/types';

const serviceTypeLabel = (t: string) => {
  if (t === 'ev_charging') return 'EV Charging';
  if (t === 'car_wash') return 'Car Wash';
  if (t === 'combo') return 'Combo Service';
  return t.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

const serviceTypeVariant: Record<string, 'primary' | 'success' | 'warning'> = {
  ev_charging: 'primary',
  car_wash: 'success',
  combo: 'warning',
};

function formatName(
  u: { name?: string | null; first_name?: string | null; last_name?: string | null; email?: string } | null
) {
  if (!u) return '—';
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return full || u.name || u.email || '—';
}

function resolveServiceLocation(record: {
  service_type: string;
  service_address?: string | null;
  ev_charging_address?: string | null;
  service_location_name?: string | null;
  address?: string | null;
}) {
  const t = record.service_type;
  if (t === 'ev_charging' || t === 'combo') {
    return (
      record.ev_charging_address?.trim() ||
      record.service_address?.trim() ||
      record.service_location_name?.trim() ||
      '—'
    );
  }
  return record.service_address?.trim() || record.address?.trim() || '—';
}

type DurationRecord = {
  id: number;
  booking_code: string;
  service_type: string;
  service_started_at: string | null;
  service_completed_at: string | null;
  service_duration_minutes: number | null;
  address: string | null;
  service_address: string | null;
  ev_charging_address: string | null;
  service_location_name: string | null;
  total_price: string | null;
  assigned_driver_user_id: number | null;
  assigned_driver: {
    id: number;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  user: {
    id: number;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  created_at: string;
};

export default function ServiceDurationReportPage() {
  const { page, pageSize, search, queryParams, setPage, handleSearch } = useTableState();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['service-duration-report', queryParams, fromDate, toDate],
    queryFn: () =>
      bookingsService
        .listServiceDurationReport({
          ...queryParams,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        })
        .then((r) => r.data.data),
  });

  const handleDownloadPdf = async (record: DurationRecord) => {
    if (!record.assigned_driver_user_id) {
      toast.error('No provider assigned to this booking');
      return;
    }
    setDownloadingId(record.id);
    try {
      const blob = await providersService.downloadServiceRecord(
        record.assigned_driver_user_id,
        record.id
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `carcomfort-service-record-${record.booking_code || record.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: TableColumn<DurationRecord>[] = [
    {
      key: 'booking_code',
      label: 'Job ID',
      render: (_, row) => (
        <span className="font-mono text-sm font-semibold text-secondary-900">
          #{row.booking_code || row.id}
        </span>
      ),
    },
    {
      key: 'service_type',
      label: 'Service Type',
      render: (_, row) => (
        <Badge variant={serviceTypeVariant[row.service_type] || 'neutral'}>
          {serviceTypeLabel(row.service_type)}
        </Badge>
      ),
    },
    {
      key: 'assigned_driver',
      label: 'Service Provider',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{formatName(row.assigned_driver)}</p>
          <p className="text-xs text-neutral-300">{row.assigned_driver?.email || '—'}</p>
          {row.assigned_driver_user_id && (
            <p className="text-xs text-neutral-200">ID #{row.assigned_driver_user_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{formatName(row.user)}</p>
          <p className="text-xs text-neutral-300">{row.user?.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'service_started_at',
      label: 'Date of Service',
      render: (_, row) =>
        formatDate(row.service_completed_at || row.service_started_at || row.created_at),
    },
    {
      key: 'service_duration_minutes',
      label: 'Duration',
      render: (_, row) => {
        const mins =
          row.service_duration_minutes != null
            ? row.service_duration_minutes
            : row.service_started_at && row.service_completed_at
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(row.service_completed_at).getTime() -
                      new Date(row.service_started_at).getTime()) /
                      60000
                  )
                )
              : null;
        return (
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-secondary-900">
              {formatDurationMinutes(mins)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'address',
      label: 'Pickup / Drop-off',
      render: (_, row) => (
        <span className="text-xs text-secondary-500">{row.address?.trim() || '—'}</span>
      ),
    },
    {
      key: 'service_address',
      label: 'Service Location',
      render: (_, row) => (
        <span className="text-xs text-secondary-500">{resolveServiceLocation(row)}</span>
      ),
    },
    {
      key: 'total_price',
      label: 'Earnings',
      render: (_, row) =>
        row.total_price ? formatCurrency(row.total_price) : '—',
    },
    {
      key: 'id',
      label: 'PDF',
      render: (_, row) => (
        <Button
          size="sm"
          variant="outline"
          icon={<ArrowDownTrayIcon className="h-3.5 w-3.5" />}
          loading={downloadingId === row.id}
          onClick={() => handleDownloadPdf(row)}
          disabled={!row.assigned_driver_user_id || downloadingId !== null}
        >
          PDF
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Service Duration Records"
        description="Completed job records with service duration — for insurance, police reports, and damage investigations."
      />

      {/* Info banner */}
      <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
        <strong>Duration measurement:</strong> Recorded from the moment the service provider receives
        the customer&apos;s 4-digit verification PIN until the job is marked as completed. Use the{' '}
        <span className="font-semibold">PDF</span> button on any row to download a printable record
        suitable for insurance claims, police reports, or damage investigations.
      </div>

      <div className="space-y-4">
        {/* Search + date filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="lg:flex-1 lg:min-w-[200px]">
            <SearchFilter
              searchValue={search}
              onSearchChange={handleSearch}
              searchPlaceholder="Search by provider name or email..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-secondary-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-secondary-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setFromDate(''); setToDate(''); }}
              >
                Clear dates
              </Button>
            )}
          </div>
        </div>

        <div className="text-xs text-neutral-300">
          Showing {data?.records.length ?? 0} of {data?.pagination.total ?? 0} completed records
        </div>

        <Table
          columns={columns}
          data={data?.records ?? []}
          isLoading={isLoading}
          emptyMessage="No completed service records found"
          rowKey={(row) => row.id}
        />

        <Pagination
          currentPage={page}
          totalPages={data?.pagination.total_pages ?? 1}
          onPageChange={setPage}
          totalItems={data?.pagination.total}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
