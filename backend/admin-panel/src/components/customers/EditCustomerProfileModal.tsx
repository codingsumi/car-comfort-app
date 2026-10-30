'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { customersService } from '@/services/customers.service';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface CustomerProfileFormData {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  phone: string;
}

interface EditCustomerProfileModalProps {
  customerId: number;
  open: boolean;
  onClose: () => void;
  initialValues?: Partial<CustomerProfileFormData>;
}

const EMPTY: CustomerProfileFormData = {
  first_name: '',
  last_name: '',
  email: '',
  country_code: '',
  phone: '',
};

function normalize(values?: Partial<CustomerProfileFormData>): CustomerProfileFormData {
  return { ...EMPTY, ...values };
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  name: keyof CustomerProfileFormData;
  value: string;
  onChange: (name: keyof CustomerProfileFormData, value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-secondary-900 placeholder-neutral-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

export function EditCustomerProfileModal({ customerId, open, onClose, initialValues = {} }: EditCustomerProfileModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerProfileFormData>(normalize(initialValues));

  useEffect(() => {
    setForm(normalize(initialValues));
  }, [initialValues, open]);

  const setField = (name: keyof CustomerProfileFormData, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const initial = normalize(initialValues);
      const payload: Partial<CustomerProfileFormData> = {};
      for (const [name, value] of Object.entries(form) as [keyof CustomerProfileFormData, string][]) {
        const nextValue = value.trim();
        if (nextValue && nextValue !== initial[name].trim()) payload[name] = nextValue;
      }
      return customersService.updateProfile(customerId, payload);
    },
    onSuccess: () => {
      toast.success('Customer profile updated.');
      void queryClient.invalidateQueries({ queryKey: ['admin-customer-detail', String(customerId)] });
      void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Edit Customer Profile" size="sm">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" name="first_name" value={form.first_name} onChange={setField} />
          <Field label="Last name" name="last_name" value={form.last_name} onChange={setField} />
        </div>
        <Field label="Email" name="email" value={form.email} onChange={setField} type="email" />
        <div className="flex gap-2">
          <div className="w-28 flex-shrink-0">
            <Field label="Country code" name="country_code" value={form.country_code} onChange={setField} placeholder="+1" />
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Phone number" name="phone" value={form.phone} onChange={setField} type="tel" />
          </div>
        </div>
        <p className="text-xs text-neutral-400">Leave a field blank to keep its current value unchanged.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button className="flex-1" onClick={() => save()} loading={isPending}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
