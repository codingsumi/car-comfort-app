'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { vehiclesService } from '@/services/vehicles.service';
import { vehicleTypesService } from '@/services/vehicleTypes.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { SafeImage } from '@/components/shared/SafeImage';
import { Table, Pagination, Badge, StatsCard, Button, Input, ConfirmModal } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { Vehicle, TableColumn } from '@/types';
import Link from 'next/link';
import {
  TruckIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  FlagIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  active: 'success',
  inactive: 'neutral',
  removed: 'danger',
  flagged: 'warning',
};

function VehicleThumb({ url, label }: { url?: string; label: string }) {
  return (
    <ThumbBox>
      {url ? (
        <SafeImage src={url} alt={label} fill className="object-cover" />
      ) : (
        <TruckIcon className="h-5 w-5 text-neutral-200" />
      )}
    </ThumbBox>
  );
}

function ThumbBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-10 w-14 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
      {children}
    </div>
  );
}

function StatusBadges({ status, openFlags }: { status: string; openFlags: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={statusVariant[status] || 'neutral'}>{status.replace(/_/g, ' ')}</Badge>
      {openFlags > 0 && <Badge variant="warning">{openFlags} flag(s)</Badge>}
    </div>
  );
}

function downloadCsvBlob(blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function canUnflagVehicle(row: Vehicle) {
  return (
    row.status !== 'removed' &&
    (row.status === 'flagged' || (row.open_flag_count ?? 0) > 0)
  );
}

export default function VehiclesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [makeFilter, setMakeFilter] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [unflagTarget, setUnflagTarget] = useState<{ id: number; label: string } | null>(null);

  const {
    page,
    search,
    sortKey,
    sortDirection,
    filters,
    queryParams,
    setPage,
    handleSort,
    handleSearch,
    handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  const { data: summary } = useQuery({
    queryKey: ['vehicles-summary'],
    queryFn: () => vehiclesService.getSummary().then((r) => r.data.data),
  });

  const { data: vehicleTypeOptions } = useQuery({
    queryKey: ['vehicle-type-options'],
    queryFn: () => vehicleTypesService.listActiveOptions().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicles', queryParams, filters, makeFilter, yearFrom, yearTo, dateFrom, dateTo],
    queryFn: () =>
      vehiclesService
        .list({
          ...queryParams,
          make: makeFilter || undefined,
          vehicle_type: filters.vehicle_type || undefined,
          status: filters.status || undefined,
          flagged_only: filters.flagged_only === 'true' ? true : undefined,
          year_from: yearFrom ? Number(yearFrom) : undefined,
          year_to: yearTo ? Number(yearTo) : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
        .then((r) => r.data.data),
  });

  const unflagMutation = useMutation({
    mutationFn: (vehicleId: number) => vehiclesService.unflag(vehicleId),
    onSuccess: (res) => {
      const cleared = res.data.data.flags_cleared;
      toast.success(
        cleared > 0 ? `Vehicle unflagged (${cleared} flag(s) cleared)` : 'Vehicle unflagged'
      );
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-summary'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to unflag vehicle');
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await vehiclesService.exportCsv({
        search: search || undefined,
        sort: sortKey,
        order: sortDirection,
        make: makeFilter || undefined,
        vehicle_type: filters.vehicle_type || undefined,
        status: filters.status || undefined,
        flagged_only: filters.flagged_only === 'true' ? true : undefined,
        year_from: yearFrom ? Number(yearFrom) : undefined,
        year_to: yearTo ? Number(yearTo) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      downloadCsvBlob(res.data as Blob);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const columns: TableColumn<Vehicle>[] = [
    {
      key: 'image',
      label: '',
      render: (_, row) => (
        <VehicleThumb url={row.images?.[0]?.url} label={`${row.make} ${row.model}`} />
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, row) => (
        <button
          type="button"
          className="text-left hover:text-primary"
          onClick={() => row.user?.id && router.push(`/customers/${row.user.id}`)}
        >
          <p className="font-medium text-secondary-900">{row.user?.name || '—'}</p>
          <p className="text-xs text-neutral-300">{row.user?.email}</p>
        </button>
      ),
    },
    { key: 'make', label: 'Make', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    { key: 'year', label: 'Year', sortable: true },
    { key: 'color', label: 'Color' },
    { key: 'license_plate', label: 'Plate', sortable: true },
    {
      key: 'vin_number',
      label: 'VIN',
      render: (v) => (
        <span className="font-mono text-xs text-neutral-400">{v ? String(v) : '—'}</span>
      ),
    },
    { key: 'vehicle_type', label: 'Type', sortable: true },
    {
      key: 'active_bookings_count',
      label: 'Active',
      render: (v) => (
        <span className={Number(v) > 0 ? 'font-medium text-primary' : 'text-neutral-300'}>
          {Number(v ?? 0)}
        </span>
      ),
    },
    {
      key: 'completed_services_count',
      label: 'Services',
      render: (v) => <span>{Number(v ?? 0)}</span>,
    },
    {
      key: 'created_at',
      label: 'Registered',
      sortable: true,
      render: (v) => formatDate(String(v)),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (v, row) => (
        <StatusBadges status={String(v)} openFlags={row.open_flag_count ?? 0} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canUnflagVehicle(row) && (
            <Button
              variant="outline"
              size="sm"
              loading={unflagMutation.isPending && unflagMutation.variables === row.id}
              onClick={() => setUnflagTarget({ id: row.id, label: `${row.make} ${row.model} (${row.license_plate})` })}
            >
              Unflag
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push(`/vehicles/${row.id}`)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vehicles"
        description="Manage customer vehicles, flags, and service history"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/vehicles/types">
              <Button variant="outline">
                <TagIcon className="mr-2 h-4 w-4" />
                Vehicle types
              </Button>
            </Link>
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total registered" value={summary.total_registered} icon={<TruckIcon className="h-5 w-5" />} />
          <StatsCard title="Active vehicles" value={summary.active_vehicles} icon={<CheckCircleIcon className="h-5 w-5" />} />
          <StatsCard
            title="With active bookings"
            value={summary.vehicles_with_active_bookings}
            icon={<CalendarDaysIcon className="h-5 w-5" />}
          />
          <StatsCard
            title="Flagged / under review"
            value={summary.flagged_vehicle_count}
            icon={<FlagIcon className="h-5 w-5" />}
          />
        </div>
      )}

      {summary && summary.top_makes.length > 0 && (
        <TopMakesCard makes={summary.top_makes} />
      )}

      <SearchFilter
        searchValue={search}
        onSearchChange={handleSearch}
        searchPlaceholder="Search plate, VIN, customer, make, model…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: '', label: 'All (excl. removed)' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'flagged', label: 'Flagged' },
              { value: 'removed', label: 'Removed' },
            ],
            value: filters.status || '',
            onChange: (v) => handleFilter('status', v),
          },
          {
            key: 'vehicle_type',
            label: 'All types',
            options: (vehicleTypeOptions || []).map((t) => ({
              value: t.name,
              label: t.name,
            })),
            value: filters.vehicle_type || '',
            onChange: (v) => handleFilter('vehicle_type', v),
          },
          {
            key: 'flagged_only',
            label: 'Flags',
            options: [
              { value: '', label: 'Any' },
              { value: 'true', label: 'Open flags only' },
            ],
            value: filters.flagged_only || '',
            onChange: (v) => handleFilter('flagged_only', v),
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-sm font-medium text-primary hover:text-primary-700"
          >
            {showAdvanced ? 'Hide Filters' : 'More Filters'}
          </button>
        }
      />

      {showAdvanced && (
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Make contains" value={makeFilter} onChange={(e) => setMakeFilter(e.target.value)} />
          <Input label="Year from" type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
          <Input label="Year to" type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
          <Input label="Registered from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="Registered to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      )}

      <Table
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={(row) => router.push(`/vehicles/${row.id}`)}
        emptyMessage="No vehicles found"
        rowKey={(row) => row.id}
      />

      <Pagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        totalItems={data?.count}
        pageSize={10}
        onPageChange={setPage}
      />

      <ConfirmModal
        open={unflagTarget !== null}
        onClose={() => setUnflagTarget(null)}
        onConfirm={() => { if (unflagTarget) { unflagMutation.mutate(unflagTarget.id); setUnflagTarget(null); } }}
        title="Unflag vehicle"
        message={unflagTarget ? `Unflag ${unflagTarget.label}? Open flags will be dismissed and status set to active.` : ''}
        confirmLabel="Unflag"
        variant="warning"
        loading={unflagMutation.isPending}
      />
    </div>
  );
}

function TopMakesCard({ makes }: { makes: { make: string; count: number }[] }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-secondary-900">Top makes</h3>
      <div className="flex flex-wrap gap-2">
        {makes.map((m) => (
          <span
            key={m.make}
            className="rounded-full bg-neutral-50 px-3 py-1 text-xs font-medium text-secondary-700"
          >
            {m.make} <span className="text-neutral-300">({m.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
