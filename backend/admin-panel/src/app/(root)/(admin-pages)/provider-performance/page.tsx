'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { providerPerformanceService } from '@/services/providerPerformance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { SafeImage } from '@/components/shared/SafeImage';
import { SearchFilter } from '@/components/shared/SearchFilter';
import {
  StatsCard, Table, Pagination, Badge, Button, Select, Modal,
} from '@/components/ui';
import { useTableState } from '@/hooks/useTableState';
import type { TableColumn } from '@/types';
import type { ProviderPerformanceItem } from '@/types/providerPerformance';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  StarIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

function formatCurrency(value: string | number): string {
  return `$${parseFloat(String(value)).toFixed(2)}`;
}

function getRatingBadge(rating: number | null) {
  if (rating === null) return <Badge variant="neutral">N/A</Badge>;
  if (rating >= 4.0) return <Badge variant="success" dot>{rating.toFixed(1)}</Badge>;
  if (rating >= 3.0) return <Badge variant="warning" dot>{rating.toFixed(1)}</Badge>;
  return <Badge variant="danger" dot>{rating.toFixed(1)}</Badge>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active': return <Badge variant="success" dot>Active</Badge>;
    case 'suspended': return <Badge variant="danger" dot>Suspended</Badge>;
    case 'deactivated': return <Badge variant="neutral" dot>Deactivated</Badge>;
    default: return <Badge variant="neutral">{status}</Badge>;
  }
}

export default function ProviderPerformancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    page, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at', defaultSortDirection: 'desc' });

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showGlobalLimitModal, setShowGlobalLimitModal] = useState(false);
  const [globalLimitForm, setGlobalLimitForm] = useState({ default_daily_limit: '', apply_to_all: false });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['provider-performance-stats'],
    queryFn: () => providerPerformanceService.getStats().then((r) => r.data.data),
  });

  const listParams = useMemo(() => ({
    ...queryParams,
    filter: filters.filter || undefined,
  }), [queryParams, filters.filter]);

  const { data, isLoading } = useQuery({
    queryKey: ['provider-performance-list', listParams],
    queryFn: () => providerPerformanceService.list(listParams).then((r) => r.data.data),
  });

  const { data: globalLimit } = useQuery({
    queryKey: ['global-service-limit'],
    queryFn: () => providerPerformanceService.getGlobalServiceLimit().then((r) => r.data.data),
  });

  useEffect(() => {
    if (globalLimit) {
      setGlobalLimitForm((f) => ({ ...f, default_daily_limit: String(globalLimit.default_daily_limit) }));
    }
  }, [globalLimit]);

  const globalLimitMutation = useMutation({
    mutationFn: (data: { default_daily_limit: number; apply_to_all?: boolean }) =>
      providerPerformanceService.updateGlobalServiceLimit(data),
    onSuccess: (res) => {
      const d = res.data.data;
      toast.success(
        d.apply_to_all
          ? `Global limit set to ${d.default_daily_limit}/day — applied to ${d.updated_providers} providers`
          : `Default limit updated to ${d.default_daily_limit}/day`
      );
      queryClient.invalidateQueries({ queryKey: ['global-service-limit'] });
      queryClient.invalidateQueries({ queryKey: ['provider-performance-list'] });
      setShowGlobalLimitModal(false);
    },
    onError: () => toast.error('Failed to update global limit'),
  });

  const flaggingMutation = useMutation({
    mutationFn: () => providerPerformanceService.runFlagging(),
    onSuccess: (res) => {
      toast.success(`Flagging completed: ${res.data.data.flagged} providers flagged`);
      queryClient.invalidateQueries({ queryKey: ['provider-performance'] });
    },
    onError: () => toast.error('Failed to run flagging'),
  });

  const handleExport = useCallback(async () => {
    try {
      const response = await providerPerformanceService.exportCsv(listParams);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `provider-performance-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowExportConfirm(false);
      toast.success('CSV exported');
    } catch {
      toast.error('Export failed');
    }
  }, [listParams]);

  const columns: TableColumn<ProviderPerformanceItem>[] = [
    {
      key: 'name',
      label: 'Provider',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.driver_profile?.profile_picture ? (
            <SafeImage
              src={row.driver_profile.profile_picture}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-300">
              {(row.name || 'P')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-secondary-900">{row.name || 'Unknown'}</p>
            <p className="text-xs text-neutral-300">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'avg_rating',
      label: 'Rating',
      sortable: false,
      render: (_, row) => getRatingBadge(row.avg_rating),
    },
    {
      key: 'total_reviews',
      label: 'Reviews',
      sortable: false,
      render: (_, row) => <span className="text-sm text-secondary-700">{row.total_reviews}</span>,
    },
    {
      key: 'completed_services',
      label: 'Completed',
      sortable: false,
      render: (_, row) => <span className="text-sm font-medium text-secondary-900">{row.completed_services}</span>,
    },
    {
      key: 'cancellation_rate',
      label: 'Cancel Rate',
      sortable: false,
      render: (_, row) => {
        const rate = parseFloat(row.cancellation_rate);
        return (
          <span className={`text-sm font-medium ${rate > 20 ? 'text-danger' : rate > 10 ? 'text-warning' : 'text-secondary-700'}`}>
            {row.cancellation_rate}%
          </span>
        );
      },
    },
    {
      key: 'total_earnings',
      label: 'Earnings',
      sortable: false,
      render: (_, row) => <span className="text-sm font-semibold text-secondary-900">{formatCurrency(row.total_earnings)}</span>,
    },
    {
      key: 'vacuum_penalties',
      label: 'Penalties',
      sortable: false,
      render: (_, row) => (
        <span className={`text-sm font-medium ${row.vacuum_penalties > 0 ? 'text-danger' : 'text-secondary-700'}`}>
          {row.vacuum_penalties}
        </span>
      ),
    },
    {
      key: 'complaints_count',
      label: 'Complaints',
      sortable: false,
      render: (_, row) => (
        <span className={`text-sm font-medium ${row.complaints_count >= 3 ? 'text-danger' : 'text-secondary-700'}`}>
          {row.complaints_count}
        </span>
      ),
    },
    {
      key: 'daily_service_limit',
      label: 'Limit',
      sortable: false,
      render: (_, row) => {
        if (!row.service_limit_enabled) return <span className="text-xs text-neutral-300">Off</span>;
        return (
          <span className="text-sm text-secondary-700">
            {row.today_completed}/{row.daily_service_limit ?? '∞'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {getStatusBadge(row.status)}
          {row.active_flags > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-50 text-danger" title={`${row.active_flags} active flag(s)`}>
              <ExclamationTriangleIcon className="h-3 w-3" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <Link href={`/provider-performance/${row.id}`}>
          <Button variant="ghost" size="sm" icon={<EyeIcon className="h-4 w-4" />}>
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Provider Performance"
        description="Monitor provider ratings, complaints, penalties and service limits"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ClockIcon className="h-4 w-4" />}
              onClick={() => setShowGlobalLimitModal(true)}
            >
              Global Limit
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowPathIcon className="h-4 w-4" />}
              onClick={() => flaggingMutation.mutate()}
              loading={flaggingMutation.isPending}
            >
              Run Flagging
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
              onClick={() => setShowExportConfirm(true)}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {statsLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-20 rounded bg-neutral-100" />
              <div className="mt-2 h-8 w-12 rounded bg-neutral-100" />
            </div>
          ))
        ) : (
          <>
            <StatsCard title="Active Providers" value={stats?.total_active_providers ?? 0} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="Below Rating" value={stats?.providers_below_rating ?? 0} icon={<ExclamationTriangleIcon className="h-5 w-5" />} changeType={stats?.providers_below_rating ? 'negative' : 'neutral'} />
            <StatsCard title="Flagged This Week" value={stats?.providers_flagged_this_week ?? 0} icon={<FlagIcon className="h-5 w-5" />} changeType={stats?.providers_flagged_this_week ? 'negative' : 'neutral'} />
            <StatsCard title="Avg Rating" value={(stats?.average_provider_rating ?? 0).toFixed(1)} icon={<StarIcon className="h-5 w-5" />} />
            <StatsCard title="Total Services" value={stats?.total_completed_services ?? 0} icon={<CheckCircleIcon className="h-5 w-5" />} />
            <StatsCard title="Vacuum Penalties" value={stats?.total_vacuum_penalties ?? 0} icon={<NoSymbolIcon className="h-5 w-5" />} />
            <StatsCard title="At Limit" value={stats?.providers_at_service_limit ?? 0} icon={<ClockIcon className="h-5 w-5" />} />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, phone..."
          filters={[
            {
              key: 'filter',
              label: 'All Providers',
              value: filters.filter || '',
              onChange: (v) => handleFilter('filter', v),
              options: [
                { label: 'Low Ratings', value: 'low_rating' },
                { label: 'High Complaints', value: 'high_complaints' },
                { label: 'High Cancellations', value: 'high_cancellations' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Top Earners', value: 'top_earners' },
              ],
            },
          ]}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <Table
          columns={columns}
          data={data?.providers ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          isLoading={isLoading}
          emptyMessage="No providers found"
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            router.push(`/provider-performance/${row.id}`);
          }}
        />
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={page}
          totalPages={data?.pagination.total_pages ?? 1}
          onPageChange={setPage}
        />
      </div>

      {/* Export Confirm */}
      <Modal open={showExportConfirm} onClose={() => setShowExportConfirm(false)} title="Export CSV" size="sm">
        <p className="text-sm text-secondary-700">Export the current provider performance data to a CSV file?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExportConfirm(false)}>Cancel</Button>
          <Button size="sm" onClick={handleExport}>Export</Button>
        </div>
      </Modal>

      {/* Global Service Limit Modal */}
      <Modal open={showGlobalLimitModal} onClose={() => setShowGlobalLimitModal(false)} title="Global Daily Service Limit" size="sm">
        <div className="space-y-4">
          {globalLimit && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
              <div><p className="text-xs text-neutral-400">Active Providers</p><p className="font-semibold">{globalLimit.total_active_providers}</p></div>
              <div><p className="text-xs text-neutral-400">With Limit Enabled</p><p className="font-semibold">{globalLimit.providers_with_limit_enabled}</p></div>
              <div><p className="text-xs text-neutral-400">Unlimited</p><p className="font-semibold">{globalLimit.providers_unlimited}</p></div>
              <div><p className="text-xs text-neutral-400">Current Default</p><p className="font-semibold">{globalLimit.default_daily_limit} services/day</p></div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Default Daily Limit</label>
            <input
              type="number"
              min="1"
              max="50"
              className="input w-full"
              placeholder="e.g. 4"
              value={globalLimitForm.default_daily_limit}
              onChange={(e) => setGlobalLimitForm((f) => ({ ...f, default_daily_limit: e.target.value }))}
            />
            <p className="mt-1 text-xs text-neutral-400">CarComfort recommended: 4 services per day</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-neutral-100 px-4 py-3">
            <input
              type="checkbox"
              id="apply_to_all"
              checked={globalLimitForm.apply_to_all}
              onChange={(e) => setGlobalLimitForm((f) => ({ ...f, apply_to_all: e.target.checked }))}
              className="h-4 w-4 cursor-pointer rounded border-neutral-200 text-primary"
            />
            <label htmlFor="apply_to_all" className="cursor-pointer text-sm text-secondary-700">
              Apply to all active providers immediately
            </label>
          </div>
          {globalLimitForm.apply_to_all && (
            <div className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 p-3">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
              <p className="text-xs text-warning-700">
                This will enable and set the daily limit to <strong>{globalLimitForm.default_daily_limit || '?'}</strong> for all {globalLimit?.total_active_providers} active providers, overriding individual settings.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGlobalLimitModal(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={globalLimitForm.apply_to_all ? 'danger' : 'primary'}
              onClick={() => globalLimitMutation.mutate({
                default_daily_limit: parseInt(globalLimitForm.default_daily_limit) || 4,
                apply_to_all: globalLimitForm.apply_to_all,
              })}
              loading={globalLimitMutation.isPending}
              disabled={!globalLimitForm.default_daily_limit}
            >
              {globalLimitForm.apply_to_all ? 'Apply to All Providers' : 'Save Default'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
