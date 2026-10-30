'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PencilIcon, PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { useTableState } from '@/hooks/useTableState';
import { vehicleTypesService } from '@/services/vehicleTypes.service';
import { Badge, Button, ConfirmModal, Input, Modal, Pagination, Select, Table } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import type {
  AdminVehicleType,
  AdminVehicleTypeForm,
  AdminVehicleTypePayload,
} from '@/types/vehicleTypes';

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const statusFilterOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const emptyForm: AdminVehicleTypeForm = {
  name: '',
  status: 'active',
  charges: '0',
};

function formatCharges(value: string | number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

export default function VehicleTypesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

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
  } = useTableState({ defaultSortKey: 'name', defaultSortDirection: 'asc', defaultPageSize: 20 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicle-types', queryParams, filters],
    queryFn: () =>
      vehicleTypesService
        .list({
          ...queryParams,
          status: filters.status || undefined,
        })
        .then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: AdminVehicleTypePayload) => vehicleTypesService.create(payload),
    onSuccess: () => {
      toast.success('Vehicle type created');
      queryClient.invalidateQueries({ queryKey: ['admin-vehicle-types'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-type-options'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminVehicleTypePayload }) =>
      vehicleTypesService.update(id, data),
    onSuccess: () => {
      toast.success('Vehicle type updated');
      queryClient.invalidateQueries({ queryKey: ['admin-vehicle-types'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-type-options'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vehicleTypesService.remove(id),
    onSuccess: () => {
      toast.success('Vehicle type deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-vehicle-types'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-type-options'] });
      setDeleteConfirm(null);
    },
  });

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(row: AdminVehicleType) {
    setForm({
      name: row.name,
      status: row.status,
      charges: String(row.charges ?? '0'),
    });
    setEditingId(row.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const charges = Number(form.charges);
    if (!Number.isFinite(charges) || charges < 0) {
      toast.error('Enter a valid charge amount');
      return;
    }

    const payload: AdminVehicleTypePayload = { name, status: form.status, charges };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const columns: TableColumn<AdminVehicleType>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_, row) => <span className="font-medium text-secondary-900">{row.name}</span>,
    },
    {
      key: 'charges',
      label: 'Charges',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">{formatCharges(row.charges)}</span>
      ),
    },
    {
      key: 'vehicle_count',
      label: 'Vehicles',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{row.vehicle_count}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      sortable: true,
      render: (_, row) => formatDate(row.updated_at),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Edit">
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirm(row.id)}
            aria-label="Deactivate"
            disabled={row.status === 'inactive'}
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
        title="Vehicle types"
        description="Manage body-style options synced with the database. Customer apps load active types from the API."
        actions={
          <div className="flex gap-2">
            <Link href="/vehicles">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                All vehicles
              </Button>
            </Link>
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add type
            </Button>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50 p-3">
        <p className="text-xs text-primary-700">
          New and updated customer vehicles must use an <strong>active</strong> type from this catalog.
          Renaming a type updates existing vehicles automatically.
        </p>
      </div>

      <SearchFilter
        searchValue={search}
        onSearchChange={handleSearch}
        searchPlaceholder="Search vehicle types..."
        filters={[
          {
            key: 'status',
            label: 'All statuses',
            value: filters.status || '',
            onChange: (v) => handleFilter('status', v),
            options: statusFilterOptions.filter((o) => o.value !== ''),
          },
        ]}
      />

      <Table
        columns={columns}
        data={data?.rows || []}
        isLoading={isLoading}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage="No vehicle types found"
        rowKey={(row) => row.id}
      />

      <Pagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        totalItems={data?.count}
        pageSize={pageSize}
      />

      <Modal open={formOpen} onClose={closeForm} title={editingId ? 'Edit vehicle type' : 'Add vehicle type'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sedan"
            required
          />
          <Input
            label="Vehicle type charges ($)"
            type="number"
            min="0"
            step="0.01"
            value={form.charges}
            onChange={(e) => setForm((f) => ({ ...f, charges: e.target.value }))}
            placeholder="0.00"
            required
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as AdminVehicleTypeForm['status'] }))
            }
            options={statusOptions}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
        title="Deactivate vehicle type"
        message="This marks the type as inactive. It cannot be deactivated if vehicles still use it."
        confirmLabel="Deactivate"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
