'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { providersService } from '@/services/providers.service';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface EditProviderProfileFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country_code: string;
  date_of_birth: string;
  address: string;
  social_security_number: string;
  drivers_license_number: string;
  drivers_license_issued_date: string;
  drivers_license_expiration_date: string;
}

interface EditProviderProfileModalProps {
  providerId: number;
  open: boolean;
  onClose: () => void;
  initialValues?: Partial<EditProviderProfileFormData>;
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
  name: keyof EditProviderProfileFormData;
  value: string;
  onChange: (name: keyof EditProviderProfileFormData, val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-secondary-900 placeholder-neutral-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

const EMPTY: EditProviderProfileFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country_code: '',
  date_of_birth: '',
  address: '',
  social_security_number: '',
  drivers_license_number: '',
  drivers_license_issued_date: '',
  drivers_license_expiration_date: '',
};

function normalizeFormData(
  values: Partial<EditProviderProfileFormData> | undefined,
): EditProviderProfileFormData {
  return { ...EMPTY, ...values };
}

export function EditProviderProfileModal({
  providerId,
  open,
  onClose,
  initialValues = {},
}: EditProviderProfileModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditProviderProfileFormData>(normalizeFormData(initialValues));

  // Sync when initialValues change (e.g. data loads after modal mounts)
  useEffect(() => {
    setForm(normalizeFormData(initialValues));
  }, [initialValues, open]);

  const setField = (name: keyof EditProviderProfileFormData, val: string) =>
    setForm((prev) => ({ ...prev, [name]: val }));

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      // Only send changed, non-empty fields so unrelated values do not revalidate.
      const payload: Partial<EditProviderProfileFormData> = {};
      const initial = normalizeFormData(initialValues);
      for (const [k, v] of Object.entries(form) as [keyof EditProviderProfileFormData, string][]) {
        const nextValue = v.trim();
        const initialValue = initial[k]?.trim() ?? '';
        if (nextValue && nextValue !== initialValue) payload[k] = nextValue;
      }
      return providersService.updateProfile(providerId, payload);
    },
    onSuccess: () => {
      toast.success('Provider profile updated.');
      void queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', String(providerId)] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Edit Provider Profile">
      <div className="flex flex-col gap-5">
        {/* Personal info */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Personal Information</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name" name="first_name" value={form.first_name} onChange={setField} />
            <Field label="Last name" name="last_name" value={form.last_name} onChange={setField} />
            <Field label="Date of birth" name="date_of_birth" value={form.date_of_birth} onChange={setField} placeholder="YYYY-MM-DD" />
            <Field label="Social security #" name="social_security_number" value={form.social_security_number} onChange={setField} />
          </div>

          {/* Email + phone each on their own full row to avoid overflow */}
          <div className="mt-3 flex flex-col gap-3">
            <Field label="Email" name="email" value={form.email} onChange={setField} type="email" />
            <div className="flex gap-2">
              <div className="w-28 flex-shrink-0">
                <Field label="Country code" name="country_code" value={form.country_code} onChange={setField} placeholder="+1" />
              </div>
              <div className="flex-1 min-w-0">
                <Field label="Phone number" name="phone" value={form.phone} onChange={setField} type="tel" />
              </div>
            </div>
            <Field label="Address" name="address" value={form.address} onChange={setField} placeholder="Full mailing address" />
          </div>
        </div>

        {/* License info */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Driver&apos;s License</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="License #" name="drivers_license_number" value={form.drivers_license_number} onChange={setField} />
            <Field label="Issued date" name="drivers_license_issued_date" value={form.drivers_license_issued_date} onChange={setField} placeholder="YYYY-MM-DD" />
            <Field label="Expiry date" name="drivers_license_expiration_date" value={form.drivers_license_expiration_date} onChange={setField} placeholder="YYYY-MM-DD" />
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
