'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { useTableState } from '@/hooks/useTableState';
import { catalogService } from '@/services/catalog.service';
import { Badge, Button, ConfirmModal, Input, Modal, Pagination, Select, Table } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import type { AdminPackage, AdminPackageForm, AdminService, CatalogServiceType } from '@/types/catalog';

const serviceTypeOptions = [
  { label: 'Car Wash', value: 'car_wash' },
  { label: 'EV Charging', value: 'ev_charging' },
  { label: 'Combo', value: 'combo' },
];

const statusFilterOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

const emptyPackageForm: AdminPackageForm = {
  package_name: '',
  price: '',
  provider_compensation_type: 'percentage',
  provider_compensation_value: '100',
  on_demand_provider_compensation_type: '',
  on_demand_provider_compensation_value: '',
  service_type: 'car_wash',
  is_active: true,
  duration_minutes: '30',
  description: '',
};

function formatPrice(value: string | number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPackageForm);

  const {
    page,
    pageSize,
    search,
    sortKey,
    sortDirection,
    filters,
    queryParams,
    setPage,
    handleSort,
    handleSearch,
    handleFilter,
  } = useTableState({ defaultSortKey: 'created_at', defaultPageSize: 20 });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => catalogService.listServices().then((r) => r.data.data),
  });

  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['admin-packages', queryParams, filters],
    queryFn: () =>
      catalogService
        .listPackages({
          ...queryParams,
          service_type: filters.service_type || undefined,
          is_active: filters.is_active || undefined,
        })
        .then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      package_name: string;
      price: number;
      provider_compensation_type: 'fixed' | 'percentage';
      provider_compensation_value: number;
      on_demand_provider_compensation_type?: 'fixed' | 'percentage';
      on_demand_provider_compensation_value?: number;
      service_type: CatalogServiceType;
      is_active: boolean;
      duration_minutes: number;
      description?: string;
    }) => catalogService.createPackage(payload),
    onSuccess: () => {
      toast.success('Package created');
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        package_name: string;
        price: number;
        provider_compensation_type: 'fixed' | 'percentage';
        provider_compensation_value: number;
        on_demand_provider_compensation_type?: 'fixed' | 'percentage';
        on_demand_provider_compensation_value?: number;
        service_type: CatalogServiceType;
        is_active: boolean;
        duration_minutes: number;
        description?: string;
      };
    }) => catalogService.updatePackage(id, data),
    onSuccess: () => {
      toast.success('Package updated');
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => catalogService.deletePackage(id),
    onSuccess: () => {
      toast.success('Package deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      setDeleteConfirm(null);
    },
  });

  function openCreate() {
    setForm(emptyPackageForm);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(pkg: AdminPackage) {
    setForm({
      package_name: pkg.package_name,
      price: String(pkg.price),
      provider_compensation_type: pkg.provider_compensation_type,
      provider_compensation_value: String(pkg.provider_compensation_value),
      on_demand_provider_compensation_type:
        pkg.on_demand_provider_compensation_type || '',
      on_demand_provider_compensation_value:
        pkg.on_demand_provider_compensation_value == null
          ? ''
          : String(pkg.on_demand_provider_compensation_value),
      service_type: pkg.service_type,
      is_active: pkg.is_active,
      duration_minutes: String(pkg.duration_minutes),
      description: pkg.description || '',
    });
    setEditingId(pkg.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyPackageForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const packageName = form.package_name.trim();
    const price = Number(form.price);
    const compensationValue = Number(form.provider_compensation_value);
    const onDemandCompensationValue =
      form.on_demand_provider_compensation_value.trim() === ''
        ? null
        : Number(form.on_demand_provider_compensation_value);
    const onDemandCompensationType =
      form.on_demand_provider_compensation_type || form.provider_compensation_type;
    const durationMinutes = Number.parseInt(form.duration_minutes, 10);

    if (!packageName) {
      toast.error('Package name is required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid price');
      return;
    }
    if (!durationMinutes || durationMinutes < 1) {
      toast.error('Duration must be at least 1 minute');
      return;
    }
    if (!Number.isFinite(compensationValue) || compensationValue < 0) {
      toast.error('Enter a valid provider compensation value');
      return;
    }
    if (
      form.provider_compensation_type === 'percentage' &&
      compensationValue > 100
    ) {
      toast.error('Percentage compensation cannot exceed 100');
      return;
    }
    if (onDemandCompensationValue != null) {
      if (!Number.isFinite(onDemandCompensationValue) || onDemandCompensationValue < 0) {
        toast.error('Enter a valid on-demand provider compensation value');
        return;
      }
      if (
        onDemandCompensationType === 'percentage' &&
        onDemandCompensationValue > 100
      ) {
        toast.error('On-demand percentage compensation cannot exceed 100');
        return;
      }
    }

    const payload = {
      package_name: packageName,
      price,
      provider_compensation_type: form.provider_compensation_type,
      provider_compensation_value: compensationValue,
      on_demand_provider_compensation_type:
        form.on_demand_provider_compensation_type || undefined,
      on_demand_provider_compensation_value: onDemandCompensationValue ?? undefined,
      service_type: form.service_type,
      is_active: form.is_active,
      duration_minutes: durationMinutes,
      description: form.description.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const packageColumns: TableColumn<AdminPackage>[] = [
    {
      key: 'package_name',
      label: 'Package',
      sortable: true,
      render: (_, row) => (
        <span className="font-medium text-secondary-900">{row.package_name}</span>
      ),
    },
    {
      key: 'service_type',
      label: 'Service type',
      sortable: true,
      render: (_, row) => row.service_type_label || row.service_type,
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (_, row) => formatPrice(row.price),
    },
    {
      key: 'provider_compensation_value',
      label: 'Provider compensation',
      render: (_, row) =>
        row.provider_compensation_type === 'fixed'
          ? formatPrice(row.provider_compensation_value)
          : `${Number(row.provider_compensation_value).toFixed(2)}%`,
    },
    {
      key: 'on_demand_provider_compensation_value',
      label: 'On-demand provider compensation',
      render: (_, row) => {
        if (row.on_demand_provider_compensation_value == null) return '—';
        const onDemandType =
          row.on_demand_provider_compensation_type || row.provider_compensation_type;
        return onDemandType === 'fixed'
          ? formatPrice(row.on_demand_provider_compensation_value)
          : `${Number(row.on_demand_provider_compensation_value).toFixed(2)}%`;
      },
    },
    {
      key: 'duration_minutes',
      label: 'Duration',
      render: (_, row) => `${row.duration_minutes} min`,
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'} dot>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (_, row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Edit package">
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirm(row.id)}
            aria-label="Delete package"
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Services"
        description="Platform services synced from the database and package pricing catalog"
      />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-secondary-900">Services catalog</h2>
        {servicesLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 w-32 rounded bg-neutral-100" />
                <div className="mt-3 h-3 w-48 rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : !services || services.length === 0 ? (
          <div className="card flex h-40 flex-col items-center justify-center">
            <p className="text-sm text-neutral-300">No services found in the database</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service: AdminService) => (
              <div key={service.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      {service.service_type}
                    </p>
                    <h3 className="text-base font-semibold text-secondary-900">{service.name}</h3>
                  </div>
                  <Badge variant={service.active_package_count > 0 ? 'success' : 'warning'} dot>
                    {service.active_package_count > 0 ? 'Live packages' : 'No active packages'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-neutral-500">
                  {service.package_count} package{service.package_count === 1 ? '' : 's'} total ·{' '}
                  {service.active_package_count} active
                </p>
                {service.icon ? (
                  <p className="mt-2 truncate text-xs text-neutral-400" title={service.icon}>
                    Icon: {service.icon}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-secondary-900">Packages &amp; pricing</h2>
            <p className="text-sm text-neutral-500">
              Create and manage packages per service type (car wash, EV charging, combo)
            </p>
          </div>
          <Button onClick={openCreate}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add package
          </Button>
        </div>

        <div className="mb-6">
          <SearchFilter
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder="Search packages..."
            filters={[
              {
                key: 'service_type',
                label: 'All service types',
                value: filters.service_type || '',
                onChange: (v) => handleFilter('service_type', v),
                options: serviceTypeOptions,
              },
              {
                key: 'is_active',
                label: 'All statuses',
                value: filters.is_active || '',
                onChange: (v) => handleFilter('is_active', v),
                options: statusFilterOptions.filter((o) => o.value !== ''),
              },
            ]}
          />
        </div>

        <Table
          columns={packageColumns}
          data={packagesData?.rows || []}
          isLoading={packagesLoading}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          emptyMessage="No packages found"
          rowKey={(row) => row.id}
        />

        <Pagination
          currentPage={page}
          totalPages={packagesData?.totalPages ?? 1}
          onPageChange={setPage}
          totalItems={packagesData?.count}
          pageSize={pageSize}
        />
      </section>

      <Modal open={formOpen} onClose={closeForm} title={editingId ? 'Edit package' : 'Add package'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Package name"
            value={form.package_name}
            onChange={(e) => setForm((f) => ({ ...f, package_name: e.target.value }))}
            required
          />
          <Select
            label="Service type"
            value={form.service_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, service_type: e.target.value as CatalogServiceType }))
            }
            options={serviceTypeOptions}
          />
          <Input
            label="Price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Provider compensation type"
              value={form.provider_compensation_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  provider_compensation_type: e.target.value as 'fixed' | 'percentage',
                }))
              }
              options={[
                { label: 'Percentage of service price', value: 'percentage' },
                { label: 'Fixed amount', value: 'fixed' },
              ]}
            />
            <Input
              label={
                form.provider_compensation_type === 'fixed'
                  ? 'Provider fixed amount'
                  : 'Provider percentage'
              }
              type="number"
              min="0"
              max={form.provider_compensation_type === 'percentage' ? '100' : undefined}
              step="0.01"
              value={form.provider_compensation_value}
              onChange={(e) =>
                setForm((f) => ({ ...f, provider_compensation_value: e.target.value }))
              }
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="On-demand compensation type"
              value={form.on_demand_provider_compensation_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  on_demand_provider_compensation_type:
                    e.target.value as 'fixed' | 'percentage' | '',
                }))
              }
              options={[
                { label: 'Use regular compensation type', value: '' },
                { label: 'Percentage', value: 'percentage' },
                { label: 'Fixed amount', value: 'fixed' },
              ]}
            />
            <Input
              label={
                (form.on_demand_provider_compensation_type || form.provider_compensation_type) ===
                'fixed'
                  ? 'On-demand provider fixed amount'
                  : 'On-demand provider percentage'
              }
              type="number"
              min="0"
              max={
                (form.on_demand_provider_compensation_type || form.provider_compensation_type) ===
                'percentage'
                  ? '100'
                  : undefined
              }
              step="0.01"
              value={form.on_demand_provider_compensation_value}
              onChange={(e) =>
                setForm((f) => ({ ...f, on_demand_provider_compensation_value: e.target.value }))
              }
              hint="If empty, regular provider compensation is used for on-demand bookings."
            />
          </div>
          <Input
            label="Duration (minutes)"
            type="number"
            min="1"
            value={form.duration_minutes}
            onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
          />
          <Select
            label="Status"
            value={form.is_active ? 'true' : 'false'}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ]}
          />
          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Save changes' : 'Create package'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
        title="Delete package"
        message="This package will be removed permanently. Packages linked to bookings cannot be deleted — deactivate them instead."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
