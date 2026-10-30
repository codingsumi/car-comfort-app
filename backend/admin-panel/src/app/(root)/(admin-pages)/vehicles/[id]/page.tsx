'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { vehiclesService, VEHICLE_FLAG_TYPES } from '@/services/vehicles.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { SafeImage } from '@/components/shared/SafeImage';
import { Button, Badge, Modal, Input, Select, ConfirmModal } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  FlagIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  UserIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { Vehicle, VehicleImage, VehicleActivityLog, VehicleServiceHistoryRow } from '@/types';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  active: 'success',
  inactive: 'neutral',
  removed: 'danger',
  flagged: 'warning',
};

const activityLabels: Record<string, string> = {
  vehicle_added: 'Vehicle added',
  vehicle_updated: 'Vehicle updated',
  vehicle_removed: 'Vehicle removed',
  vehicle_status_changed: 'Status changed',
  vehicle_flagged: 'Vehicle flagged',
  vehicle_unflagged: 'Vehicle unflagged',
  flag_status_updated: 'Flag updated',
  duplicate_detected: 'Duplicate detected',
  image_flagged: 'Image flagged',
  image_unflagged: 'Image unflagged',
  image_removed: 'Image removed',
};

export default function VehicleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vehicleId = Number(id);

  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagType, setFlagType] = useState('suspicious_activity');
  const [flagReason, setFlagReason] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [unflagConfirmOpen, setUnflagConfirmOpen] = useState(false);
  const [imageRemoveId, setImageRemoveId] = useState<number | null>(null);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId, bookingsPage, bookingStatusFilter],
    queryFn: () =>
      vehiclesService
        .getById(vehicleId, {
          bookings_page: bookingsPage,
          bookings_limit: 10,
          booking_status: bookingStatusFilter || undefined,
        })
        .then((r) => r.data.data.vehicle),
    enabled: Number.isFinite(vehicleId),
  });

  const removeMutation = useMutation({
    mutationFn: () => vehiclesService.remove(vehicleId, removeReason),
    onSuccess: () => {
      toast.success('Vehicle removed');
      setRemoveOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Removal failed');
    },
  });

  const flagMutation = useMutation({
    mutationFn: () =>
      vehiclesService.createFlag(vehicleId, { flag_type: flagType, reason: flagReason }),
    onSuccess: () => {
      toast.success('Vehicle flagged');
      setFlagOpen(false);
      setFlagReason('');
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
    },
    onError: () => toast.error('Failed to flag vehicle'),
  });

  const flagImageMutation = useMutation({
    mutationFn: ({ imageId, flagged }: { imageId: number; flagged: boolean }) =>
      vehiclesService.flagImage(vehicleId, imageId, flagged),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] }),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => vehiclesService.deleteImage(vehicleId, imageId),
    onSuccess: () => {
      toast.success('Image removed');
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ flagId, status }: { flagId: number; status: string }) =>
      vehiclesService.updateFlag(flagId, { review_status: status }),
    onSuccess: () => {
      toast.success('Flag updated');
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-summary'] });
    },
    onError: () => toast.error('Failed to update flag'),
  });

  const unflagMutation = useMutation({
    mutationFn: () => vehiclesService.unflag(vehicleId),
    onSuccess: (res) => {
      const cleared = res.data.data.flags_cleared;
      toast.success(
        cleared > 0 ? `Vehicle unflagged (${cleared} flag(s) cleared)` : 'Vehicle unflagged'
      );
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-summary'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to unflag vehicle');
    },
  });

  if (isLoading || !vehicle) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    );
  }

  const v = vehicle as Vehicle;
  const canRemove = v.status !== 'removed' && (v.active_bookings_count ?? 0) === 0;
  const openFlags =
    v.flags?.filter((f) => ['open', 'investigating'].includes(f.review_status)) ?? [];
  const canUnflag =
    v.status !== 'removed' &&
    (v.status === 'flagged' || openFlags.length > 0 || (v.open_flag_count ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/vehicles')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <PageHeader
            title={`${v.make} ${v.model} (${v.year})`}
            description={`Plate ${v.license_plate}${v.vin_number ? ` · VIN ${v.vin_number}` : ''}`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant[v.status] || 'neutral'}>{v.status}</Badge>
          {v.status !== 'removed' && (
            <>
              {canUnflag && (
                <Button
                  variant="outline"
                  loading={unflagMutation.isPending}
                  onClick={() => setUnflagConfirmOpen(true)}
                >
                  Unflag
                </Button>
              )}
              <Button variant="outline" onClick={() => setFlagOpen(true)}>
                <FlagIcon className="mr-1 h-4 w-4" />
                Flag
              </Button>
              <Button
                variant="danger"
                disabled={!canRemove}
                onClick={() => setRemoveOpen(true)}
              >
                <TrashIcon className="mr-1 h-4 w-4" />
                Remove
              </Button>
              {!canRemove && (v.active_bookings_count ?? 0) > 0 && (
                <div className="w-full mt-2 flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2">
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-600" />
                  <p className="text-xs text-warning-700">
                    <span className="font-semibold">Cannot remove:</span> This vehicle has{' '}
                    <strong>{v.active_bookings_count}</strong> active booking{(v.active_bookings_count ?? 0) > 1 ? 's' : ''} in progress.
                    The vehicle can be removed once all active bookings are completed or cancelled.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {(v.duplicate_hints?.length ?? 0) > 0 && (
        <div className="card flex gap-2 border-warning-200 bg-warning-50">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-secondary-900">Possible duplicates detected</p>
            <ul className="mt-1 list-inside list-disc text-sm text-neutral-400">
              {v.duplicate_hints!.map((h) => (
                <li key={h.kind}>
                  {h.kind.replace(/_/g, ' ')} — vehicle IDs: {h.other_vehicle_ids.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-secondary-900">Vehicle information</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <InfoItem label="Make" value={v.make} />
            <InfoItem label="Model" value={v.model} />
            <InfoItem label="Year" value={String(v.year)} />
            <InfoItem label="Color" value={v.color} />
            <InfoItem label="Type" value={v.vehicle_type} />
            <InfoItem label="Fuel" value={v.fuel_type} />
            <InfoItem label="Plate" value={v.license_plate} />
            <InfoItem label="VIN" value={v.vin_number || '—'} />
            <InfoItem label="Registered" value={formatDate(v.created_at)} />
          </dl>
          {v.notes && (
            <p className="mt-3 text-sm text-neutral-400">
              <span className="font-medium text-secondary-700">Notes:</span> {v.notes}
            </p>
          )}
          <h3 className="mt-4 text-sm font-semibold text-secondary-900">Photos</h3>
          {!v.images?.length ? (
            <p className="mt-2 text-sm text-neutral-300">No images</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {v.images.map((img) => (
                <VehicleImageTile
                  key={img.id}
                  img={img}
                  onPreview={() => setPreviewUrl(img.url)}
                  onFlag={() => flagImageMutation.mutate({ imageId: img.id, flagged: !img.is_flagged })}
                  onRemove={() => setImageRemoveId(img.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-secondary-900">Customer</h2>
          {v.user ? (
            <div className="mt-2 space-y-1">
              <p className="font-medium text-secondary-900">{v.user.name || '—'}</p>
              <p className="text-sm text-neutral-300">{v.user.email}</p>
              {v.user.phone && <p className="text-sm text-neutral-300">{v.user.phone}</p>}
              <dl className="mt-3 space-y-2 text-sm">
                <StatRow label="Vehicles owned" value={String(v.customer_summary?.total_vehicles_owned ?? '—')} />
                <StatRow label="Total bookings" value={String(v.customer_summary?.total_bookings ?? '—')} />
              </dl>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => router.push(`/customers/${v.user!.id}`)}
              >
                <UserIcon className="mr-2 h-4 w-4" />
                View customer profile
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-300">No customer linked</p>
          )}
          <div className="mt-4 border-t border-neutral-100 pt-4 text-sm space-y-1">
            <p>Active bookings: <strong>{v.active_bookings_count ?? 0}</strong></p>
            <p>Completed services: <strong>{v.completed_services_count ?? 0}</strong></p>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-secondary-900">Service history</h2>
          <Select
            className="w-44"
            value={bookingStatusFilter}
            onChange={(e) => {
              setBookingStatusFilter(e.target.value);
              setBookingsPage(1);
            }}
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Completed', value: 'completed' },
              { label: 'In progress', value: 'in_progress' },
              { label: 'Confirmed', value: 'confirmed' },
              { label: 'Cancelled', value: 'cancelled' },
            ]}
          />
        </div>
        <ServiceHistoryTable rows={v.service_history ?? []} onView={(bid) => router.push(`/bookings/${bid}`)} />
        {v.service_history_pagination && v.service_history_pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={bookingsPage <= 1} onClick={() => setBookingsPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-neutral-300">
              Page {bookingsPage} of {v.service_history_pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={bookingsPage >= v.service_history_pagination.totalPages}
              onClick={() => setBookingsPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {v.flags && v.flags.length > 0 && (
        <div className="card space-y-3">
          <h2 className="mb-3 text-sm font-semibold text-secondary-900">Flags</h2>
          <ul className="space-y-3">
            {v.flags.map((f) => (
              <li key={f.id} className="rounded-lg border border-neutral-100 p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="warning">{f.flag_type.replace(/_/g, ' ')}</Badge>
                  <Badge variant="neutral">{f.review_status}</Badge>
                </div>
                {f.reason && <p className="mt-1 text-neutral-400">{f.reason}</p>}
                <p className="mt-1 text-xs text-neutral-300">{formatDate(f.created_at)}</p>
                {['open', 'investigating'].includes(f.review_status) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={updateFlagMutation.isPending}
                      onClick={() => updateFlagMutation.mutate({ flagId: f.id, status: 'resolved' })}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={updateFlagMutation.isPending}
                      onClick={() => updateFlagMutation.mutate({ flagId: f.id, status: 'dismissed' })}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="mb-4 text-sm font-semibold text-secondary-900">Activity timeline</h2>
        <ActivityTimeline items={v.activity_timeline ?? []} />
      </div>

      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} size="md">
        <h3 className="mb-2 text-lg font-semibold">Remove vehicle</h3>
        <p className="mb-4 text-sm text-neutral-400">
          This soft-deletes the vehicle from the customer account. The customer will be notified.
        </p>
        <Input label="Reason (required)" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={removeMutation.isPending} disabled={removeReason.trim().length < 3} onClick={() => removeMutation.mutate()}>
            Confirm removal
          </Button>
        </div>
      </Modal>

      <Modal open={flagOpen} onClose={() => setFlagOpen(false)} size="md">
        <h3 className="mb-4 text-lg font-semibold">Flag vehicle</h3>
        <Select label="Flag type" value={flagType} onChange={(e) => setFlagType(e.target.value)} options={VEHICLE_FLAG_TYPES.map((t) => ({ label: t.label, value: t.value }))} />
        <Input className="mt-3" label="Notes" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
          <Button loading={flagMutation.isPending} onClick={() => flagMutation.mutate()}>Submit flag</Button>
        </div>
      </Modal>

      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)} size="lg">
        {previewUrl && (
          <SafeImage src={previewUrl} alt="Preview" width={800} height={600} className="mx-auto max-h-[70vh] w-auto object-contain" />
        )}
      </Modal>

      <ConfirmModal
        open={unflagConfirmOpen}
        onClose={() => setUnflagConfirmOpen(false)}
        onConfirm={() => { setUnflagConfirmOpen(false); unflagMutation.mutate(); }}
        title="Unflag vehicle"
        message="Clear all open flags and restore this vehicle to active status?"
        confirmLabel="Unflag"
        variant="warning"
        loading={unflagMutation.isPending}
      />

      <ConfirmModal
        open={imageRemoveId !== null}
        onClose={() => setImageRemoveId(null)}
        onConfirm={() => { if (imageRemoveId !== null) { deleteImageMutation.mutate(imageRemoveId); setImageRemoveId(null); } }}
        title="Remove image"
        message="Remove this image from the vehicle? This cannot be undone."
        confirmLabel="Remove"
        variant="danger"
        loading={deleteImageMutation.isPending}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-300">{label}</dt>
      <dd className="font-medium text-secondary-900">{value}</dd>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-300">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VehicleImageTile({
  img,
  onPreview,
  onFlag,
  onRemove,
}: {
  img: VehicleImage;
  onPreview: () => void;
  onFlag: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border ${img.is_flagged ? 'border-warning' : 'border-neutral-100'}`}>
      <button type="button" className="relative block aspect-[4/3] w-full" onClick={onPreview}>
        <SafeImage src={img.url} alt="Vehicle" fill className="object-cover" />
      </button>
      <div className="flex flex-wrap gap-1 p-2">
        <Button size="sm" variant="ghost" onClick={() => window.open(img.url, '_blank')}>
          <ArrowDownTrayIcon className="h-4 w-4" />
        </Button>
        <Button size="sm" variant={img.is_flagged ? 'warning' : 'outline'} onClick={onFlag}>
          {img.is_flagged ? 'Unflag' : 'Flag'}
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}

function ServiceHistoryTable({ rows, onView }: { rows: VehicleServiceHistoryRow[]; onView: (id: number) => void }) {
  if (!rows.length) return <p className="text-sm text-neutral-300">No bookings for this vehicle</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-neutral-300">
            <th className="py-2 pr-4">Booking</th>
            <th className="py-2 pr-4">Service</th>
            <th className="py-2 pr-4">Provider</th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.booking_id} className="border-b border-neutral-50">
              <td className="py-2 pr-4 font-mono text-xs">{r.booking_code || r.booking_id}</td>
              <td className="py-2 pr-4">{r.service_type.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4">{r.provider?.name || '—'}</td>
              <td className="py-2 pr-4">{formatDate(r.booking_date)}</td>
              <td className="py-2 pr-4">{r.amount != null ? `$${Number(r.amount).toFixed(2)}` : '—'}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="py-2">
                <Button size="sm" variant="ghost" onClick={() => onView(r.booking_id)}>View</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTimeline({ items }: { items: VehicleActivityLog[] }) {
  if (!items.length) return <p className="text-sm text-neutral-300">No activity recorded yet</p>;
  return (
    <ul className="space-y-4 border-l-2 border-neutral-100 pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm font-medium text-secondary-900">{activityLabels[item.activity_type] || item.activity_type}</p>
          <p className="text-xs text-neutral-300">
            {formatDate(item.created_at)} · {item.actor_type}
            {item.actor_id ? ` #${item.actor_id}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
