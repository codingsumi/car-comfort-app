'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { promotionsService, type PromotionalDiscount, type PromotionFormData } from '@/services/promotions.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Table, Pagination, Badge, Button, Modal, Input, Select } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PowerIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

type PromoStatus = 'active' | 'inactive' | 'scheduled' | 'expired';

const statusVariant: Record<PromoStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
  active: 'success',
  scheduled: 'primary',
  inactive: 'warning',
  expired: 'danger',
};

interface LocalForm {
  name: string;
  description: string;
  discount_type: 'percentage' | 'flat';
  discount_value: string;
  applicable_services: string[];
  audience: 'all' | 'new_customers';
  recurrence: 'one_time' | 'weekly' | 'monthly';
  start_date: string;
  end_date: string;
  status: string;
  max_uses: string;
  notify_customers: boolean;
}

const EMPTY_FORM: LocalForm = {
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  applicable_services: [],
  audience: 'all',
  recurrence: 'one_time',
  start_date: '',
  end_date: '',
  status: 'active',
  max_uses: '',
  notify_customers: true,
};

const SERVICE_OPTIONS = [
  { label: 'Car Wash', value: 'car_wash' },
  { label: 'EV Charging', value: 'ev_charging' },
  { label: 'Combo', value: 'combo' },
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Expired', value: 'expired' },
];

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionalDiscount | null>(null);
  const [form, setForm] = useState<LocalForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<PromotionalDiscount | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', page, statusFilter],
    queryFn: () =>
      promotionsService.list({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PromotionFormData) => promotionsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion created successfully');
      closeModal();
    },
    onError: () => toast.error('Failed to create promotion'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PromotionFormData }) =>
      promotionsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion updated');
      closeModal();
    },
    onError: () => toast.error('Failed to update promotion'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => promotionsService.toggle(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success(`Promotion is now ${res.data.status}`);
    },
    onError: () => toast.error('Failed to toggle promotion'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => promotionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promotion deleted');
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete promotion'),
  });

  const notifyMutation = useMutation({
    mutationFn: (id: number) => promotionsService.notify(id),
    onSuccess: (res) => toast.success(res.message || 'Customers notified'),
    onError: () => toast.error('Failed to send notification'),
  });

  function openCreate() {
    setEditingPromo(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(promo: PromotionalDiscount) {
    setEditingPromo(promo);
    setForm({
      name: promo.name,
      description: promo.description ?? '',
      discount_type: promo.discount_type,
      discount_value: String(promo.discount_value),
      applicable_services: promo.applicable_services ?? [],
      audience: promo.audience,
      recurrence: promo.recurrence,
      start_date: promo.start_date ?? '',
      end_date: promo.end_date ?? '',
      status: promo.status === 'expired' ? 'inactive' : promo.status,
      max_uses: promo.max_uses != null ? String(promo.max_uses) : '',
      notify_customers: false, // don't re-notify on edit by default
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPromo(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.discount_value || Number(form.discount_value) <= 0)
      errs.discount_value = 'Discount value must be greater than 0';
    if (form.discount_type === 'percentage' && Number(form.discount_value) > 100)
      errs.discount_value = 'Percentage cannot exceed 100';
    if (form.end_date && form.start_date && form.end_date < form.start_date)
      errs.end_date = 'End date must be after start date';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload(): PromotionFormData {
    return {
      name: form.name.trim(),
      description: form.description || undefined,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      applicable_services: form.applicable_services.length > 0 ? form.applicable_services : null,
      audience: form.audience,
      recurrence: form.recurrence,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      status: form.status,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      notify_customers: form.notify_customers,
    };
  }

  function handleSubmit() {
    if (!validateForm()) return;
    const payload = buildPayload();
    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleService(svc: string) {
    setForm((prev) => {
      const current = prev.applicable_services;
      const next = current.includes(svc)
        ? current.filter((s) => s !== svc)
        : [...current, svc];
      return { ...prev, applicable_services: next };
    });
  }

  const promos: PromotionalDiscount[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  const columns: TableColumn<PromotionalDiscount>[] = [
    {
      key: 'name',
      label: 'Promotion Name',
      render: (_, row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.name}</p>
          {row.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (_, row) => (
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {row.discount_type === 'percentage'
            ? `${Number(row.discount_value)}%`
            : `$${Number(row.discount_value).toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'recurrence',
      label: 'Recurrence',
      render: (_, row) => (
        <span className="capitalize text-sm text-slate-600 dark:text-slate-300">
          {row.recurrence.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'services',
      label: 'Services',
      render: (_, row) => {
        const svcs = row.applicable_services;
        if (!svcs || svcs.length === 0)
          return <span className="text-slate-400 text-sm">All services</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {svcs.map((s) => (
              <span
                key={s}
                className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 capitalize"
              >
                {s.replace('_', ' ')}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'period',
      label: 'Period',
      render: (_, row) => (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {row.start_date ? formatDate(row.start_date) : '—'} →{' '}
          {row.end_date ? formatDate(row.end_date) : 'No end'}
        </div>
      ),
    },
    {
      key: 'uses',
      label: 'Uses',
      render: (_, row) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {row.uses_count}
          {row.max_uses != null ? ` / ${row.max_uses}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status as PromoStatus] ?? 'neutral'}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMutation.mutate(row.id)}
            disabled={row.status === 'expired'}
            title={row.status === 'active' ? 'Deactivate' : 'Activate'}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 dark:text-slate-400"
          >
            <PowerIcon
              className={`w-4 h-4 ${row.status === 'active' ? 'text-green-500' : ''}`}
            />
          </button>
          <button
            onClick={() => notifyMutation.mutate(row.id)}
            disabled={row.status === 'expired' || row.status === 'inactive'}
            title="Notify customers via push + email"
            className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed text-blue-500"
          >
            <BellAlertIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(row)}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Promotional Discounts"
        description="Create and manage weekly, monthly, or one-time promotional sales"
        actions={
          <Button onClick={openCreate} icon={<PlusIcon className="w-4 h-4" />}>
            New Promotion
          </Button>
        }
      />

      <div className="mb-4 flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <Table
          columns={columns}
          data={promos}
          isLoading={isLoading}
          emptyMessage="No promotions found. Create one to get started."
        />
      </div>

      {total > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          onPageChange={setPage}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingPromo ? 'Edit Promotion' : 'New Promotion'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Promotion Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Summer Car Wash Sale"
            />
            {formErrors.name && (
              <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Discount Type *
              </label>
              <Select
                value={form.discount_type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    discount_type: e.target.value as 'percentage' | 'flat',
                  }))
                }
                options={[
                  { label: 'Percentage (%)', value: 'percentage' },
                  { label: 'Flat Amount ($)', value: 'flat' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Discount Value *
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))}
                placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 10.00'}
              />
              {formErrors.discount_value && (
                <p className="text-xs text-red-500 mt-1">{formErrors.discount_value}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recurrence
              </label>
              <Select
                value={form.recurrence}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    recurrence: e.target.value as 'one_time' | 'weekly' | 'monthly',
                  }))
                }
                options={[
                  { label: 'One-time', value: 'one_time' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Audience
              </label>
              <Select
                value={form.audience}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    audience: e.target.value as 'all' | 'new_customers',
                  }))
                }
                options={[
                  { label: 'All Customers', value: 'all' },
                  { label: 'New Customers Only', value: 'new_customers' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Applicable Services
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleService(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    form.applicable_services.includes(opt.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {form.applicable_services.length === 0 && (
                <span className="text-xs text-slate-400 self-center">(All services)</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              />
              {formErrors.end_date && (
                <p className="text-xs text-red-500 mt-1">{formErrors.end_date}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Uses{' '}
                <span className="text-slate-400 font-normal">(blank = unlimited)</span>
              </label>
              <Input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={(e) => setForm((p) => ({ ...p, max_uses: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <Select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Scheduled (auto-activate on start date)', value: 'scheduled' },
                  { label: 'Inactive (draft)', value: 'inactive' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Notify customers toggle — shown on create, optional on edit */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.notify_customers}
              onChange={(e) => setForm((p) => ({ ...p, notify_customers: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Notify all customers via push &amp; email
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {form.status === 'scheduled'
                  ? 'Notification will be sent automatically when the promotion goes live on the start date.'
                  : 'Notification will be sent immediately when the promotion is created.'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {editingPromo ? 'Save Changes' : 'Create Promotion'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Promotion"
        size="sm"
      >
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Are you sure you want to delete{' '}
          <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
