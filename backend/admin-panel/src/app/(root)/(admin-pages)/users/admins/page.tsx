'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { useTableState } from '@/hooks/useTableState';
import { usersService } from '@/services/users.service';
import { Badge, Button, ConfirmModal, Dropdown, Input, Modal, Pagination, Table } from '@/components/ui';
import { formatJoinedDate } from '@/utils/formatDate';
import type { User, TableColumn } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

const emptyForm = { name: '', email: '', phone: '', password: '' };
const emptyEditForm = { name: '', phone: '', status: 'active', suspended_reason: '' };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const queryClient = useQueryClient();

  const { page, pageSize, search, sortKey, sortDirection, queryParams, setPage, handleSort, handleSearch } =
    useTableState();

  // ── Modal state ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admins', queryParams],
    queryFn: () =>
      usersService.list({ ...queryParams, role: 'admin' }).then((r) => {
        const d = r.data.data;
        return {
          rows: d.users,
          count: d.pagination.total,
          totalPages: d.pagination.total_pages,
        };
      }),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => usersService.createAdmin(form),
    onSuccess: () => {
      toast.success('Admin user created');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to create admin');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      usersService.updateAdmin(editTarget!.id, {
        name: editForm.name,
        phone: editForm.phone || undefined,
        status: editForm.status,
        suspended_reason: editForm.status === 'suspended' ? editForm.suspended_reason : undefined,
      }),
    onSuccess: () => {
      toast.success('Admin updated');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setEditTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to update admin');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      usersService.updateAdmin(deactivateTarget!.id, { status: 'deactivated' }),
    onSuccess: () => {
      toast.success('Admin deactivated');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setDeactivateTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || 'Failed to deactivate admin');
    },
  });

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = (user: User) => {
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      status: user.status || 'active',
      suspended_reason: user.suspended_reason || '',
    });
    setEditTarget(user);
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Admin',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary">
            <span className="text-xs font-bold">{(row.name?.[0] || row.email[0]).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-medium text-secondary-900">{row.name || '—'}</p>
            <p className="text-xs text-neutral-300">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (_, row) => <span className="text-sm text-secondary-700">{row.phone || '—'}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status || 'active'] || 'neutral'} dot>
          {(row.status || 'active').charAt(0).toUpperCase() + (row.status || 'active').slice(1)}
        </Badge>
      ),
    },
    {
      key: 'is_verified',
      label: 'Verified',
      render: (_, row) => (
        <Badge variant={row.is_verified ? 'success' : 'warning'} dot>
          {row.is_verified ? 'Verified' : 'Unverified'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (_, row) => <span className="text-sm text-neutral-300">{formatJoinedDate(row)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className="rounded p-1 hover:bg-neutral-100">
                <EllipsisVerticalIcon className="h-5 w-5 text-neutral-300" />
              </button>
            }
            items={[
              {
                label: 'Edit',
                onClick: () => openEdit(row),
                icon: <PencilIcon className="h-4 w-4" />,
              },
              ...(row.status === 'active'
                ? [
                    {
                      label: 'Suspend',
                      onClick: () => {
                        openEdit(row);
                        setEditForm((f) => ({ ...f, status: 'suspended' }));
                      },
                      icon: <NoSymbolIcon className="h-4 w-4" />,
                    },
                  ]
                : [
                    {
                      label: 'Reactivate',
                      onClick: () => {
                        openEdit(row);
                        setEditForm((f) => ({ ...f, status: 'active' }));
                      },
                      icon: <CheckCircleIcon className="h-4 w-4" />,
                    },
                  ]),
              ...(row.status !== 'deactivated'
                ? [
                    {
                      label: 'Deactivate',
                      onClick: () => setDeactivateTarget(row),
                      icon: <TrashIcon className="h-4 w-4" />,
                      danger: true,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Admin Users"
        description="Manage admin accounts, roles, and access status"
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<PlusIcon className="h-4 w-4" />}>
            Add Admin
          </Button>
        }
      />

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, or phone..."
        />
        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          isLoading={isLoading}
          emptyMessage="No admin users found"
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

      {/* ── Create Admin Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setForm(emptyForm); }}
        title="Add Admin User"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@carcomfort.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            label="Phone (optional)"
            placeholder="+1 555 000 0000"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Temporary Password"
            type="password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
          <p className="text-xs text-neutral-300">
            The admin will be able to change their password after first login.
          </p>
          <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.name || !form.email || !form.password}
            >
              Create Admin
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Admin Modal ── */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Admin"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Account Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-secondary-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {editForm.status === 'suspended' && (
            <Input
              label="Suspension Reason"
              placeholder="Reason for suspension..."
              value={editForm.suspended_reason}
              onChange={(e) => setEditForm((f) => ({ ...f, suspended_reason: e.target.value }))}
            />
          )}
          <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Deactivate Confirm Modal ── */}
      <ConfirmModal
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate()}
        loading={deactivateMutation.isPending}
        title="Deactivate Admin"
        message={`Are you sure you want to deactivate ${deactivateTarget?.name || deactivateTarget?.email}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </>
  );
}
