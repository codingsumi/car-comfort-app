'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import { bookingsService } from '@/services/bookings.service';
import { useSocket } from '@/hooks/useSocket';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button, Badge, Modal, Input, Tabs, ConfirmModal } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ClockIcon,
  UserIcon,
  TruckIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import type { BookingDetailResponse } from '@/types';
import BookingMapView from './BookingMapView';
import { SafeImage } from '@/components/shared/SafeImage';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success',
  refunded: 'success',
  in_progress: 'primary',
  confirmed: 'primary',
  assigned: 'primary',
  pending_payment: 'warning',
  cancelled: 'danger',
  failed: 'danger',
  disputed: 'danger',
};

const disputeStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  open: 'danger',
  investigating: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

const timelineIcons: Record<string, string> = {
  booking_created: '📋',
  provider_assigned: '👤',
  provider_accepted: '✅',
  status_changed: '🔄',
  booking_cancelled: '❌',
  dispute_opened: '⚠️',
  dispute_updated: '📝',
  refund_processed: '💰',
  photos_uploaded: '📷',
  payment_completed: '💳',
  DRIVER_STARTED_TO_CUSTOMER: '🚗',
  DRIVER_REACHED_CUSTOMER: '📍',
  DRIVER_STARTED_TO_SERVICE_CENTER: '🏢',
  DRIVER_REACHED_SERVICE_CENTER: '✅',
  DRIVER_HEADING_TO_NEXT_SERVICE_STOP: '➡️',
  OTP_VERIFIED: '🔐',
  SERVICE_STARTED: '🔧',
  SERVICE_COMPLETED: '✔️',
  SECOND_SERVICE_STARTED: '🔧',
  SECOND_SERVICE_COMPLETED: '✔️',
  VEHICLE_PICKED_UP: '🚙',
  VEHICLE_DROPPED_OFF: '🏁',
};

function formatTimelineEventLabel(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

// ─── Photo grid helper ─────────────────────────────────────────────────────
function PhotoGrid({
  photos,
  onView,
}: {
  photos: { id: number; src: string; label?: string }[];
  onView: (src: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative cursor-pointer overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50"
          onClick={() => photo.src && onView(photo.src)}
        >
          <div className="relative h-36 w-full">
            <SafeImage
              src={photo.src}
              alt={photo.label || 'Booking photo'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
            <PhotoIcon className="h-6 w-6 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity" />
          </div>
          {photo.label && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white capitalize">
              {photo.label.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeComplaint, setDisputeComplaint] = useState('');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [resolveDisputeOpen, setResolveDisputeOpen] = useState(false);
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [resolveNotes, setResolveNotes] = useState('');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [exportingRecord, setExportingRecord] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editServiceAddress, setEditServiceAddress] = useState('');
  const [editProviderId, setEditProviderId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteTestBookingOpen, setDeleteTestBookingOpen] = useState(false);
  const [archiveTestBookingOpen, setArchiveTestBookingOpen] = useState(false);

  const { data: response, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsService.getById(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  const booking = response?.booking;
  const providerRating = response?.providerRating;

  // Real-time updates for this specific booking
  const handleBookingUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
  }, [queryClient, id]);

  useSocket({
    booking_updated: handleBookingUpdate,
    booking_cancelled: handleBookingUpdate,
    refund_processed: handleBookingUpdate,
    provider_location_updated: handleBookingUpdate,
  });

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: () => bookingsService.cancel(Number(id), cancelReason),
    onSuccess: () => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setCancelOpen(false);
      setCancelReason('');
    },
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      bookingsService.createDispute(Number(id), {
        customer_complaint: disputeComplaint || undefined,
        admin_notes: disputeNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Dispute created');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setDisputeOpen(false);
      setDisputeComplaint('');
      setDisputeNotes('');
    },
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      bookingsService.processRefund(Number(id), {
        amount: parseFloat(refundAmount),
        reason: refundReason,
      }),
    onSuccess: () => {
      toast.success('Refund processed');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: (disputeId: number) =>
      bookingsService.resolveDispute(disputeId, {
        status: resolveStatus,
        admin_notes: resolveNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Dispute updated');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setResolveDisputeOpen(false);
      setResolveNotes('');
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof bookingsService.editBooking>[1] = {};
      if (editScheduledAt.trim()) payload.scheduled_at = new Date(editScheduledAt).toISOString();
      if (editServiceAddress.trim()) payload.service_address = editServiceAddress.trim();
      if (editProviderId.trim()) {
        const pid = parseInt(editProviderId.trim(), 10);
        payload.assigned_driver_user_id = Number.isFinite(pid) ? pid : null;
      }
      if (editNotes !== '') payload.notes = editNotes.trim() || null;
      return bookingsService.editBooking(Number(id), payload);
    },
    onSuccess: (res) => {
      const updated = res.data.data?.updated_fields ?? [];
      toast.success(updated.length ? `Updated: ${updated.join(', ')}` : 'Booking updated');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setEditOpen(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update booking');
    },
  });

  const deleteTestBookingMutation = useMutation({
    mutationFn: () => bookingsService.deleteTestBooking(Number(id)),
    onSuccess: () => {
      toast.success('Test booking deleted');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
      router.replace('/bookings');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'This booking cannot be deleted');
    },
  });

  const archiveTestBookingMutation = useMutation({
    mutationFn: (archived: boolean) => bookingsService.archiveTestBooking(Number(id), archived),
    onSuccess: (res) => {
      const archived = res.data.data?.archived;
      toast.success(archived ? 'Booking archived' : 'Booking restored');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
      if (archived) {
        router.replace('/bookings');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to archive booking');
    },
  });

  const openEditModal = () => {
    setEditScheduledAt(
      booking?.scheduled_at
        ? new Date(booking.scheduled_at).toISOString().slice(0, 16)
        : ''
    );
    setEditServiceAddress(booking?.service_address ?? '');
    setEditProviderId(booking?.assigned_driver_user_id ? String(booking.assigned_driver_user_id) : '');
    setEditNotes(booking?.notes ?? '');
    setEditOpen(true);
  };

  const activeDispute = useMemo(
    () => booking?.disputes?.find((d) => ['open', 'investigating'].includes(d.status)),
    [booking?.disputes]
  );

  // Show map for any assigned or in_progress booking — including "Waiting for GPS" state
  const showMap = booking && ['assigned', 'in_progress'].includes(booking.status);

  const handleExportRecord = useCallback(async () => {
    if (!booking || exportingRecord) return;
    setExportingRecord(true);
    try {
      const blob = await bookingsService.exportRecord(Number(id));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `booking-record-${booking.booking_code || booking.id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Booking record exported');
    } catch {
      toast.error('Failed to export booking record');
    } finally {
      setExportingRecord(false);
    }
  }, [booking, exportingRecord, id]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-sm text-neutral-300">Booking not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4" size="sm">Go Back</Button>
      </div>
    );
  }

  const canCancel = !['completed', 'cancelled', 'refunded'].includes(booking.status);
  const canEdit   = !['completed', 'cancelled', 'refunded'].includes(booking.status);
  const canDispute = !['cancelled', 'disputed'].includes(booking.status) && !activeDispute;
  const canRefund = ['completed', 'cancelled', 'disputed'].includes(booking.status);
  const canDeleteTestBooking = ['draft', 'pending_payment', 'failed', 'cancelled'].includes(booking.status);
  const canArchiveBooking = !booking.test_archived_at;

  const beforePhotos  = booking.service_images?.before   ?? [];
  const afterPhotos   = booking.service_images?.after    ?? [];
  const customerPhotos = booking.service_images?.customer ?? [];
  const vehiclePhotos  = booking.vehicle?.images          ?? [];
  const totalPhotos    = beforePhotos.length + afterPhotos.length + customerPhotos.length + vehiclePhotos.length;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline', count: booking.timeline?.length },
    { key: 'tracking', label: 'GPS Tracking' },
    { key: 'photos', label: 'Photos', count: totalPhotos || undefined },
    { key: 'disputes', label: 'Disputes', count: booking.disputes?.length },
    { key: 'refunds', label: 'Refunds', count: booking.refund_requests?.length },
  ];

  return (
    <>
      {/* Header */}
      <PageHeader
        title={`Booking ${booking.booking_code || `#${booking.id}`}`}
        description={`Created ${formatDate(booking.created_at, 'MMM d, yyyy h:mm a')}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeftIcon className="h-4 w-4" />}>
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExportRecord()}
              loading={exportingRecord}
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            >
              Export PDF
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={openEditModal} icon={<PencilSquareIcon className="h-4 w-4" />}>
                Edit Booking
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={() => setCancelOpen(true)} icon={<XCircleIcon className="h-4 w-4" />}>
                Cancel
              </Button>
            )}
            {canDispute && (
              <Button variant="warning" onClick={() => setDisputeOpen(true)} icon={<ExclamationTriangleIcon className="h-4 w-4" />}>
                Dispute
              </Button>
            )}
            {canRefund && (
              <Button variant="outline" onClick={() => setRefundOpen(true)} icon={<CurrencyDollarIcon className="h-4 w-4" />}>
                Refund
              </Button>
            )}
            {canDeleteTestBooking && (
              <Button variant="danger" onClick={() => setDeleteTestBookingOpen(true)} icon={<TrashIcon className="h-4 w-4" />}>
                Delete Test Booking
              </Button>
            )}
            {canArchiveBooking && (
              <Button variant="outline" onClick={() => setArchiveTestBookingOpen(true)} icon={<ArchiveBoxIcon className="h-4 w-4" />}>
                Archive Booking
              </Button>
            )}
            {booking.test_archived_at && (
              <Button
                variant="outline"
                onClick={() => archiveTestBookingMutation.mutate(false)}
                loading={archiveTestBookingMutation.isPending}
                icon={<ArrowUturnLeftIcon className="h-4 w-4" />}
              >
                Restore Booking
              </Button>
            )}
          </div>
        }
      />

      {/* Status Banner */}
      <div className="mb-6 flex items-center gap-3">
        <Badge variant={statusVariant[booking.status] || 'neutral'} dot>
          {booking.status.replace(/_/g, ' ')}
        </Badge>
        {booking.tracking_status && (
          <Badge variant="primary">
            Tracking: {booking.tracking_status.replace(/_/g, ' ')}
          </Badge>
        )}
        {booking.dispute_status && (
          <Badge variant={disputeStatusVariant[booking.dispute_status] || 'neutral'}>
            Dispute: {booking.dispute_status}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Booking Info */}
              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Booking Information</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Booking ID', value: booking.booking_code || `#${booking.id}` },
                    { label: 'Status', value: <Badge variant={statusVariant[booking.status] || 'neutral'} dot>{booking.status.replace(/_/g, ' ')}</Badge> },
                    { label: 'Scheduled', value: booking.scheduled_at ? formatDate(booking.scheduled_at, 'MMM d, yyyy h:mm a') : '—' },
                    { label: 'Service Duration', value: formatDurationMinutes(booking.service_duration_minutes) },
                    { label: 'Service Started', value: booking.service_started_at ? formatDate(booking.service_started_at, 'MMM d, yyyy h:mm a') : '—' },
                    { label: 'Service Completed', value: booking.service_completed_at ? formatDate(booking.service_completed_at, 'MMM d, yyyy h:mm a') : '—' },
                    { label: 'Service Type', value: booking.service_type?.replace(/_/g, ' ') || '—' },
                    { label: 'Package', value: booking.package?.name || '—' },
                    { label: 'Schedule Type', value: booking.schedule_type || '—' },
                    { label: 'Base Price', value: booking.base_price ? `$${parseFloat(booking.base_price).toFixed(2)}` : '—' },
                    { label: 'Service Fee', value: booking.service_fee ? `$${parseFloat(booking.service_fee).toFixed(2)}` : '$0.00' },
                    { label: 'Tax', value: booking.tax ? `$${parseFloat(booking.tax).toFixed(2)}` : '$0.00' },
                    { label: 'Total', value: booking.total_price ? `$${parseFloat(booking.total_price).toFixed(2)}` : '—' },
                    ...(booking.service_type?.replace(/[_\s]/g, '').includes('ev')
                      ? [{
                        label: 'EV Account Card',
                        value: booking.ev_account_card_on_file === true
                          ? <Badge variant="success" dot>Card on file</Badge>
                          : booking.ev_account_card_on_file === false
                            ? <Badge variant="danger" dot>No card on file</Badge>
                            : 'Not provided',
                      }]
                      : []),
                    { label: 'Notes', value: booking.notes || '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                      <span className="text-sm text-neutral-300">{item.label}</span>
                      <span className="text-sm font-medium text-secondary-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {/* Customer */}
                <div className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-secondary-900">Customer</h3>
                    {booking.user && (
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/customers/${booking.user_id}`)}>
                        View Profile
                      </Button>
                    )}
                  </div>
                  {booking.user ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary">
                        <UserIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-secondary-900">{booking.user.name || '—'}</p>
                        <p className="text-xs text-neutral-300">{booking.user.email}</p>
                        {booking.user.phone && <p className="text-xs text-neutral-300">{booking.user.phone}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-300">—</p>
                  )}
                </div>

                {/* Provider */}
                <div className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-secondary-900">Provider</h3>
                    {booking.assigned_driver && (
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/providers/${booking.assigned_driver_user_id}`)}>
                        View Profile
                      </Button>
                    )}
                  </div>
                  {booking.assigned_driver ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50 text-success">
                        <TruckIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-secondary-900">{booking.assigned_driver.name || '—'}</p>
                        <p className="text-xs text-neutral-300">{booking.assigned_driver.email}</p>
                        {booking.assigned_driver.phone && <p className="text-xs text-neutral-300">{booking.assigned_driver.phone}</p>}
                        {providerRating?.avg_rating && (
                          <p className="text-xs text-warning">⭐ {parseFloat(providerRating.avg_rating).toFixed(1)} ({providerRating.review_count} reviews)</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-300">Not yet assigned</p>
                  )}
                </div>

                {/* Vehicle */}
                <div className="card">
                  <h3 className="mb-3 text-base font-semibold text-secondary-900">Vehicle</h3>
                  {booking.vehicle ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-secondary-900">
                        {booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.year})
                      </p>
                      <p className="text-xs text-neutral-300">
                        Color: {booking.vehicle.color} &middot; Plate: {booking.vehicle.license_plate}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-300">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions */}
            {booking.transactions && booking.transactions.length > 0 && (
              <div className="card">
                <h3 className="mb-3 text-base font-semibold text-secondary-900">Transactions</h3>
                <div className="table-container">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {booking.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-secondary-900">{tx.transaction_code}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">${parseFloat(tx.amount).toFixed(2)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={tx.status === 'succeeded' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'} dot>{tx.status}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">{formatDate(tx.created_at, 'MMM d, yyyy h:mm a')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cancellation Details */}
            {booking.status === 'cancelled' && booking.cancellation_reason && (
              <div className="card border-danger-50 bg-danger-50/30">
                <h3 className="mb-2 text-base font-semibold text-danger">Cancellation Details</h3>
                <p className="text-sm text-secondary-500">{booking.cancellation_reason}</p>
                <p className="mt-1 text-xs text-neutral-300">
                  Cancelled by: {booking.cancelled_by || '—'}
                  {booking.cancelled_at && ` on ${formatDate(booking.cancelled_at, 'MMM d, yyyy h:mm a')}`}
                </p>
              </div>
            )}

            {/* Service Completion Notes */}
            {(() => {
              const sn = booking.service_notes;
              const rows: { label: string; value: string }[] = [];
              if (sn?.vehicle_parked_location_label)
                rows.push({ label: 'Vehicle parked', value: sn.vehicle_parked_location_label });
              if (sn?.provider_park_location_label)
                rows.push({ label: 'Provider parking', value: sn.provider_park_location_label });
              if (sn?.vehicle_key_location_label)
                rows.push({ label: 'Key handover', value: sn.vehicle_key_location_label });
              if (sn?.key_return_location_label)
                rows.push({ label: 'Key return', value: sn.key_return_location_label });
              if (sn?.parking_instructions?.trim())
                rows.push({ label: 'Parking instructions', value: sn.parking_instructions.trim() });
              if (sn?.notes?.trim())
                rows.push({ label: 'Provider notes', value: sn.notes.trim() });
              if (rows.length === 0) return null;
              return (
                <div className="card">
                  <h3 className="mb-4 text-base font-semibold text-secondary-900">Service Completion Notes</h3>
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
                        <span className="shrink-0 text-sm text-neutral-300">{row.label}</span>
                        <span className="text-right text-sm font-medium text-secondary-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-secondary-900">Booking Timeline</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleExportRecord()}
                loading={exportingRecord}
                icon={<ArrowDownTrayIcon className="h-4 w-4" />}
              >
                Export PDF
              </Button>
            </div>
            {booking.timeline && booking.timeline.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 h-full w-0.5 bg-neutral-100" />
                <div className="space-y-6">
                  {[...booking.timeline].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((event) => (
                    <div key={`${event.source || 'admin'}-${event.id}`} className="relative flex gap-4 pl-10">
                      <div className="absolute left-2 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm ring-2 ring-neutral-200">
                        {timelineIcons[event.event_type] || '•'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-secondary-900">
                            {formatTimelineEventLabel(event.event_type)}
                          </span>
                          {event.actor_type && (
                            <Badge variant="neutral">{event.actor_type}</Badge>
                          )}
                          {event.source === 'tracking' && (
                            <Badge variant="primary">lifecycle</Badge>
                          )}
                        </div>
                        {event.message && (
                          <p className="mt-0.5 text-sm text-neutral-300">{event.message}</p>
                        )}
                        <p className="mt-1 text-xs text-neutral-200">
                          {formatDate(event.created_at, 'MMM d, yyyy h:mm:ss a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-300">No timeline events recorded</p>
            )}
          </div>
        )}

        {/* GPS TRACKING TAB */}
        {activeTab === 'tracking' && (
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-secondary-900">GPS Tracking</h3>
            {showMap ? (
              <BookingMapView
                bookingId={Number(id)}
                customerLat={booking.latitude ? parseFloat(String(booking.latitude)) : null}
                customerLng={booking.longitude ? parseFloat(String(booking.longitude)) : null}
                driverLocations={booking.driver_locations || []}
              />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50">
                <MapPinIcon className="h-8 w-8 text-neutral-200" />
                <p className="mt-2 text-sm text-neutral-300">
                  GPS tracking is only available for active bookings (assigned or in progress).
                </p>
              </div>
            )}
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            {totalPhotos === 0 && (
              <div className="card flex h-48 flex-col items-center justify-center gap-2">
                <PhotoIcon className="h-10 w-10 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-300">No photos uploaded for this booking</p>
              </div>
            )}

            {/* Before Service Photos */}
            {beforePhotos.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-secondary-900">Before Service</h3>
                  <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning">{beforePhotos.length} photo{beforePhotos.length !== 1 ? 's' : ''}</span>
                </div>
                <PhotoGrid photos={beforePhotos.map(p => ({ id: p.id, src: p.image_url || p.url, label: 'Before' }))} onView={(src) => { setSelectedImage(src); setImageViewerOpen(true); }} />
              </div>
            )}

            {/* After Service Photos */}
            {afterPhotos.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-secondary-900">After Service</h3>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success">{afterPhotos.length} photo{afterPhotos.length !== 1 ? 's' : ''}</span>
                </div>
                <PhotoGrid photos={afterPhotos.map(p => ({ id: p.id, src: p.image_url || p.url, label: 'After' }))} onView={(src) => { setSelectedImage(src); setImageViewerOpen(true); }} />
              </div>
            )}

            {/* Customer / Pickup Photos */}
            {customerPhotos.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-secondary-900">Customer / Pickup Photos</h3>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary">{customerPhotos.length} photo{customerPhotos.length !== 1 ? 's' : ''}</span>
                </div>
                <PhotoGrid photos={customerPhotos.map(p => ({ id: p.id, src: p.image_url || p.url, label: 'Customer' }))} onView={(src) => { setSelectedImage(src); setImageViewerOpen(true); }} />
              </div>
            )}

            {/* Vehicle Profile Photos */}
            {vehiclePhotos.length > 0 && (
              <div className="card">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-secondary-900">Vehicle Photos</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-400">{vehiclePhotos.length} photo{vehiclePhotos.length !== 1 ? 's' : ''}</span>
                  {booking.vehicle && (
                    <span className="text-xs text-neutral-300">
                      {booking.vehicle.make} {booking.vehicle.model} · {booking.vehicle.license_plate}
                    </span>
                  )}
                </div>
                <PhotoGrid
                  photos={(vehiclePhotos as Array<{ id: number; image_url?: string; image_path?: string; image_type?: string }>).map(p => ({ id: p.id, src: p.image_url ?? p.image_path ?? '', label: p.image_type ?? 'Vehicle' }))}
                  onView={(src) => { setSelectedImage(src); setImageViewerOpen(true); }}
                />
              </div>
            )}

            {/* Service Notes (shown here too for context alongside photos) */}
            {(() => {
              const sn = booking.service_notes;
              const rows: { label: string; value: string }[] = [];
              if (sn?.vehicle_parked_location_label) rows.push({ label: 'Vehicle parked', value: sn.vehicle_parked_location_label });
              if (sn?.provider_park_location_label) rows.push({ label: 'Provider parking', value: sn.provider_park_location_label });
              if (sn?.vehicle_key_location_label) rows.push({ label: 'Key handover', value: sn.vehicle_key_location_label });
              if (sn?.key_return_location_label) rows.push({ label: 'Key return', value: sn.key_return_location_label });
              if (sn?.parking_instructions?.trim()) rows.push({ label: 'Parking instructions', value: sn.parking_instructions.trim() });
              if (sn?.notes?.trim()) rows.push({ label: 'Provider notes', value: sn.notes.trim() });
              if (rows.length === 0) return null;
              return (
                <div className="card">
                  <h3 className="mb-4 text-base font-semibold text-secondary-900">Service Notes</h3>
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
                        <span className="shrink-0 text-sm text-neutral-300">{row.label}</span>
                        <span className="text-right text-sm font-medium text-secondary-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* DISPUTES TAB */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-300">
                Disputes are linked to this booking. Manage all disputes from the{' '}
                <Link href="/disputes" className="font-medium text-primary hover:text-primary-700">
                  Disputes section →
                </Link>
              </p>
            </div>
            {booking.disputes && booking.disputes.length > 0 ? (
              booking.disputes.map((dispute) => (
                <div key={dispute.id} className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-secondary-900">Dispute #{dispute.id}</h4>
                      <Badge variant={disputeStatusVariant[dispute.status] || 'neutral'}>{dispute.status}</Badge>
                    </div>
                    {['open', 'investigating'].includes(dispute.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setResolveDisputeOpen(true); }}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {dispute.customer_complaint && (
                      <div>
                        <p className="text-xs font-medium text-neutral-300">Customer Complaint</p>
                        <p className="text-sm text-secondary-700">{dispute.customer_complaint}</p>
                      </div>
                    )}
                    {dispute.provider_response && (
                      <div>
                        <p className="text-xs font-medium text-neutral-300">Provider Response</p>
                        <p className="text-sm text-secondary-700">{dispute.provider_response}</p>
                      </div>
                    )}
                    {dispute.admin_notes && (
                      <div>
                        <p className="text-xs font-medium text-neutral-300">Admin Notes</p>
                        <p className="text-sm text-secondary-700">{dispute.admin_notes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 pt-2 text-xs text-neutral-200">
                      <span>Created: {formatDate(dispute.created_at, 'MMM d, yyyy h:mm a')}</span>
                      {dispute.resolved_at && <span>Resolved: {formatDate(dispute.resolved_at, 'MMM d, yyyy h:mm a')}</span>}
                      {dispute.resolver && <span>By: {dispute.resolver.name}</span>}
                    </div>
                  </div>

                  {/* Resolve Dispute Modal */}
                  <Modal open={resolveDisputeOpen} onClose={() => setResolveDisputeOpen(false)} title="Resolve Dispute" size="sm">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-secondary-700">Status</label>
                        <select
                          className="input w-full"
                          value={resolveStatus}
                          onChange={(e) => setResolveStatus(e.target.value)}
                        >
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <Input
                        label="Admin Notes"
                        placeholder="Add notes about the resolution..."
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setResolveDisputeOpen(false)}>Cancel</Button>
                        <Button
                          variant="primary"
                          onClick={() => resolveDisputeMutation.mutate(dispute.id)}
                          loading={resolveDisputeMutation.isPending}
                        >
                          Update Dispute
                        </Button>
                      </div>
                    </div>
                  </Modal>
                </div>
              ))
            ) : (
              <div className="card flex h-40 flex-col items-center justify-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-neutral-200" />
                <p className="mt-2 text-sm text-neutral-300">No disputes for this booking</p>
              </div>
            )}
          </div>
        )}

        {/* REFUNDS TAB */}
        {activeTab === 'refunds' && (
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-secondary-900">Refund History</h3>
            {booking.refund_requests && booking.refund_requests.length > 0 ? (
              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Stripe ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {booking.refund_requests.map((refund) => (
                      <tr key={refund.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-secondary-900">#{refund.id}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                          {refund.amount ? `$${parseFloat(refund.amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-sm text-neutral-300">{refund.reason || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={refund.status === 'refunded' ? 'success' : refund.status === 'rejected' ? 'danger' : 'warning'}>
                            {refund.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-neutral-300">
                          {refund.stripe_refund_id || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                          {formatDate(refund.created_at, 'MMM d, yyyy h:mm a')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center">
                <CurrencyDollarIcon className="h-8 w-8 text-neutral-200" />
                <p className="mt-2 text-sm text-neutral-300">No refunds for this booking</p>
              </div>
            )}
            {booking.refund_amount && parseFloat(booking.refund_amount) > 0 && (
              <div className="mt-4 rounded-lg bg-neutral-50 p-3">
                <p className="text-sm font-medium text-secondary-900">
                  Total Refunded: <span className="text-success">${parseFloat(booking.refund_amount).toFixed(2)}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}

      <ConfirmModal
        open={deleteTestBookingOpen}
        onClose={() => setDeleteTestBookingOpen(false)}
        onConfirm={() => deleteTestBookingMutation.mutate()}
        title="Delete Test Booking?"
        message="This permanently removes an unpaid test booking and its related test data. Paid or operational bookings cannot be deleted."
        confirmLabel="Delete Permanently"
        loading={deleteTestBookingMutation.isPending}
      />

      <ConfirmModal
        open={archiveTestBookingOpen}
        onClose={() => setArchiveTestBookingOpen(false)}
        onConfirm={() => archiveTestBookingMutation.mutate(true)}
        title="Archive Booking?"
        message="This hides the booking from normal admin lists but keeps its payment and audit history. You can restore it later from the Archived filter."
        confirmLabel="Archive Booking"
        loading={archiveTestBookingMutation.isPending}
      />

      {/* Cancel Modal */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Booking" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Are you sure you want to cancel this booking? This will notify the customer and provider.
          </p>
          <Input
            label="Cancellation Reason *"
            placeholder="Enter reason for cancellation..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Close</Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispute Modal */}
      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Open Dispute" size="md">
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Mark this booking as disputed. This will change the booking status.
          </p>
          <Input
            label="Customer Complaint"
            placeholder="Describe the customer's complaint..."
            value={disputeComplaint}
            onChange={(e) => setDisputeComplaint(e.target.value)}
          />
          <Input
            label="Admin Notes"
            placeholder="Add internal notes..."
            value={disputeNotes}
            onChange={(e) => setDisputeNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button
              variant="warning"
              onClick={() => disputeMutation.mutate()}
              loading={disputeMutation.isPending}
            >
              Open Dispute
            </Button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Process Refund" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Process a refund for this booking via Stripe.
            {booking.total_price && (
              <span className="block mt-1 font-medium">
                Booking total: ${parseFloat(booking.total_price).toFixed(2)}
                {booking.refund_amount && parseFloat(booking.refund_amount) > 0 && (
                  <> | Already refunded: ${parseFloat(booking.refund_amount).toFixed(2)}</>
                )}
              </span>
            )}
          </p>
          <Input
            label="Refund Amount *"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
          <Input
            label="Reason *"
            placeholder="Reason for refund..."
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => refundMutation.mutate()}
              loading={refundMutation.isPending}
              disabled={!refundAmount || !refundReason.trim() || parseFloat(refundAmount) <= 0}
            >
              Process Refund
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Booking" size="md">
        <div className="space-y-5">
          <p className="text-sm text-neutral-300">
            Update schedule, address, provider assignment, or internal notes. Only fill in fields you want to change.
          </p>

          {/* Schedule */}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Schedule Date &amp; Time
            </label>
            <input
              type="datetime-local"
              className="input w-full"
              value={editScheduledAt}
              onChange={(e) => setEditScheduledAt(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            />
            {booking?.scheduled_at && (
              <p className="mt-1 text-xs text-neutral-200">
                Current: {new Date(booking.scheduled_at).toLocaleString()}
              </p>
            )}
          </div>

          {/* Service Address */}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Service Address
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="Enter new service address..."
              value={editServiceAddress}
              onChange={(e) => setEditServiceAddress(e.target.value)}
              maxLength={500}
            />
            {booking?.service_address && (
              <p className="mt-1 text-xs text-neutral-200">Current: {booking.service_address}</p>
            )}
          </div>

          {/* Provider ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Provider User ID
            </label>
            <input
              type="number"
              className="input w-full"
              placeholder="Enter provider user ID (leave blank to keep current)"
              value={editProviderId}
              onChange={(e) => setEditProviderId(e.target.value)}
            />
            {booking?.assigned_driver && (
              <p className="mt-1 text-xs text-neutral-200">
                Current: {booking.assigned_driver.name || booking.assigned_driver.email} (ID: {booking.assigned_driver_user_id})
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-200">
              Only approved providers can be assigned. Enter ID 0 to unassign.
            </p>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Internal Notes
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Add internal notes (admin only, not visible to customer)..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              maxLength={2000}
            />
            <p className="mt-1 text-xs text-neutral-200">{editNotes.length}/2000 characters</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => editMutation.mutate()}
              loading={editMutation.isPending}
              icon={<PencilSquareIcon className="h-4 w-4" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal open={imageViewerOpen} onClose={() => setImageViewerOpen(false)} title="Photo" size="lg">
        <div className="flex flex-col items-center">
          {selectedImage ? (
            <SafeImage
              src={selectedImage}
              alt="Booking photo"
              width={1200}
              height={900}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : null}
          <a
            href={selectedImage}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download Image
          </a>
        </div>
      </Modal>
    </>
  );
}
