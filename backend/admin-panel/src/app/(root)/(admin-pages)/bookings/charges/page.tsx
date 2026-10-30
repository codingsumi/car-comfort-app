'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { bookingChargesService } from '@/services/bookingCharges.service';
import { Badge, Button, ConfirmModal, Input, Modal, Select, Table } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import type {
  BookingCharge,
  BookingChargeForm,
  BookingChargePayload,
  BookingChargeServiceApplicability,
  CreateBookingChargePayload,
} from '@/types/bookingCharges';

const NON_DELETABLE_CHARGE_CODES = new Set(['carcomfort_service_fee']);

const LOCKED_CHARGE_APPLICABILITY: Record<string, BookingChargeServiceApplicability> = {
  carcomfort_service_fee: 'car_wash',
};

const SYSTEM_CHARGE_INFO: Record<string, string> = {
  carcomfort_service_fee:
    'Fixed fee added when a customer enters their own preferred car wash package (not preset packages). Car wash and combo bookings only.',
};

const SERVICE_APPLICABILITY_OPTIONS: {
  label: string;
  value: BookingChargeServiceApplicability;
}[] = [
  { label: 'All services', value: 'all' },
  { label: 'Car wash only', value: 'car_wash' },
  { label: 'EV charging only', value: 'ev_charging' },
];

const emptyForm: BookingChargeForm = {
  code: '',
  label: '',
  amount: '',
  is_active: true,
  service_applicability: 'all',
};

function formatApplicability(value: string): string {
  return SERVICE_APPLICABILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatAmount(value: string | number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `$${num.toFixed(2)}`;
}

function formatCode(code: string): string {
  return code.replace(/_/g, ' ');
}

export default function BookingChargesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookingCharge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BookingCharge | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: charges, isLoading } = useQuery({
    queryKey: ['admin-booking-charges'],
    queryFn: () => bookingChargesService.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBookingChargePayload) => bookingChargesService.create(data),
    onSuccess: () => {
      toast.success('Charge created');
      queryClient.invalidateQueries({ queryKey: ['admin-booking-charges'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BookingChargePayload }) =>
      bookingChargesService.update(id, data),
    onSuccess: () => {
      toast.success('Charge updated');
      queryClient.invalidateQueries({ queryKey: ['admin-booking-charges'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bookingChargesService.delete(id),
    onSuccess: () => {
      toast.success('Charge deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-booking-charges'] });
      setDeleteConfirm(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(row: BookingCharge) {
    setEditing(row);
    setForm({
      code: row.code,
      label: row.label,
      amount: String(row.amount ?? '0'),
      is_active: row.is_active,
      service_applicability: row.service_applicability || 'all',
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toLowerCase();
    const label = form.label.trim();
    const amount = Number(form.amount);
    if (!editing && !/^[a-z0-9_]+$/.test(code)) {
      toast.error('Code can only use lowercase letters, numbers, and underscores');
      return;
    }
    if (!label) {
      toast.error('Label is required');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const payload: BookingChargePayload = {
      label,
      amount,
      is_active: form.is_active,
      service_applicability: form.service_applicability,
    };
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: payload,
      });
    } else {
      createMutation.mutate({ ...payload, code });
    }
  }

  const columns: TableColumn<BookingCharge>[] = [
    {
      key: 'label',
      label: 'Charge',
      render: (_, row) => (
        <div>
          <p className="font-medium text-secondary-900">{row.label}</p>
          <p className="text-xs text-neutral-400">{formatCode(row.code)}</p>
          {SYSTEM_CHARGE_INFO[row.code] ? (
            <p className="mt-1 text-xs text-neutral-500">{SYSTEM_CHARGE_INFO[row.code]}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_, row) => (
        <span className="text-sm font-semibold text-secondary-900">{formatAmount(row.amount)}</span>
      ),
    },
    {
      key: 'service_applicability',
      label: 'Applies to',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">
          {formatApplicability(row.service_applicability || 'all')}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={row.is_active ? 'success' : 'neutral'} dot>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      render: (_, row) => formatDate(row.updated_at),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Edit charge">
            <PencilIcon className="h-4 w-4" />
          </Button>
          {!NON_DELETABLE_CHARGE_CODES.has(row.code) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(row)}
              aria-label="Delete charge"
            >
              <TrashIcon className="h-4 w-4 text-red-500" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Booking charges"
        description="Platform fees applied to bookings — stored in the database and used at payment and cancellation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add charge
            </Button>
            <Link href="/bookings">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                All bookings
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50 p-3">
        <p className="text-xs text-primary-700">
          <strong>Convenience fee</strong> and <strong>on-demand fee</strong> (ASAP) are included in booking
          totals at review/confirm. <strong>Cancellation fee</strong> is used when a customer cancels after the
          provider is en route. Towing and no-show fees are available for those flows when enabled. Use{' '}
          <strong>Applies to</strong> so a charge only appears for car wash, EV charging, or all services.{' '}
          <strong>CarComfort service fee</strong> ($99 default) applies when a customer enters a custom car wash
          package — it can be activated or deactivated but not removed.
        </p>
      </div>

      <Table
        columns={columns}
        data={charges || []}
        isLoading={isLoading}
        emptyMessage="No booking charges configured"
        rowKey={(row) => row.id}
      />

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? `Edit — ${editing.label}` : 'Add charge'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {editing ? (
            <p className="text-xs text-neutral-400">
              Code: <span className="font-mono">{editing.code}</span>
            </p>
          ) : (
            <Input
              label="Code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, '_') }))
              }
              placeholder="custom_booking_fee"
              required
            />
          )}
          <Input
            label="Display label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
          />
          <Input
            label="Amount ($)"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
          {editing && LOCKED_CHARGE_APPLICABILITY[editing.code] ? (
            <p className="text-xs text-neutral-500">
              Applies to: {formatApplicability(LOCKED_CHARGE_APPLICABILITY[editing.code])} (fixed for this
              charge)
            </p>
          ) : (
            <Select
              label="Applies to"
              value={form.service_applicability}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  service_applicability: e.target.value as BookingChargeServiceApplicability,
                }))
              }
              options={SERVICE_APPLICABILITY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            />
          )}
          {editing && SYSTEM_CHARGE_INFO[editing.code] ? (
            <p className="text-xs text-neutral-500">{SYSTEM_CHARGE_INFO[editing.code]}</p>
          ) : null}
          <Select
            label="Status"
            value={form.is_active ? 'true' : 'false'}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save changes' : 'Create charge'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        title="Delete booking charge"
        message={`Delete "${deleteConfirm?.label || 'this charge'}"? This removes it from booking fee lookups.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
