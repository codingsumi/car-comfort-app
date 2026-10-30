'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { providersService } from '@/services/providers.service';
import { bookingsService } from '@/services/bookings.service';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface AssignProviderModalProps {
  bookingId: number;
  bookingLabel: string;
  currentProviderId?: number | null;
  currentProviderName?: string | null;
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
}

export function AssignProviderModal({
  bookingId,
  bookingLabel,
  currentProviderId,
  currentProviderName,
  open,
  onClose,
  onAssigned,
}: AssignProviderModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-providers-approved', search],
    queryFn: () =>
      providersService.list({ approval_status: 'approved', status: 'active', search: search || undefined, limit: 50 }),
    enabled: open,
    staleTime: 30_000,
  });

  const providers = data?.data?.data?.providers ?? [];

  const { mutate: assign, isPending } = useMutation({
    mutationFn: (providerId: number | null) =>
      bookingsService.editBooking(bookingId, { assigned_driver_user_id: providerId }),
    onSuccess: (_res, providerId) => {
      const label = providerId
        ? (providers.find((p) => p.id === providerId)?.name ?? `Provider #${providerId}`)
        : 'Unassigned';
      toast.success(`Booking ${bookingLabel} ${providerId ? `assigned to ${label}` : 'unassigned'}`);
      void queryClient.invalidateQueries({ queryKey: ['fleet-map'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['unassigned-bookings'] });
      onAssigned?.();
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? 'Could not assign provider. Try again.');
    },
  });

  const handleAssign = useCallback(() => {
    if (selectedId === undefined) return;
    assign(selectedId);
  }, [assign, selectedId]);

  const handleUnassign = useCallback(() => {
    assign(null);
  }, [assign]);

  return (
    <Modal open={open} onClose={onClose} title={`Assign Provider — ${bookingLabel}`}>
      <div className="flex flex-col gap-4">
        {currentProviderName && (
          <div className="flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2.5 text-sm">
            <span className="text-secondary-700">
              Current: <span className="font-semibold">{currentProviderName}</span>
            </span>
            <button
              onClick={handleUnassign}
              disabled={isPending}
              className="flex items-center gap-1 text-xs font-medium text-danger hover:text-danger-700 disabled:opacity-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Unassign
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search providers by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-secondary-900 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Provider list */}
        <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-primary" />
            </div>
          ) : providers.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">No approved providers found.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {providers.map((p) => {
                const isCurrent = p.id === currentProviderId;
                const isSelected = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : p.id)}
                      disabled={isCurrent}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isCurrent
                          ? 'cursor-default bg-neutral-50 opacity-60'
                          : isSelected
                          ? 'bg-primary-50'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <UserCircleIcon className="h-7 w-7 flex-shrink-0 text-neutral-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-secondary-900">
                          {p.name ?? p.email}
                          {isCurrent && (
                            <span className="ml-1.5 text-xs font-normal text-neutral-400">(current)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-neutral-400">{p.email}</p>
                        {p.avg_rating ? (
                          <p className="text-xs text-warning">
                            ⭐ {parseFloat(String(p.avg_rating)).toFixed(1)}
                          </p>
                        ) : null}
                      </div>
                      {isSelected && (
                        <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleAssign}
            disabled={selectedId === null || isPending}
            loading={isPending}
          >
            {currentProviderId ? 'Reassign' : 'Assign'} Provider
          </Button>
        </div>
      </div>
    </Modal>
  );
}
