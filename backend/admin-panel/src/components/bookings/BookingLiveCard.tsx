'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { Booking } from '@/types';
import {
  UserIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  CurrencyDollarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

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

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  assigned: 'Provider Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

const trackingLabel: Record<string, string> = {
  on_the_way: 'On The Way',
  arrived: 'Arrived',
  service_started: 'Service Started',
  service_completed: 'Service Completed',
};

interface BookingLiveCardProps {
  booking: Booking;
  isNew?: boolean;
}

export function BookingLiveCard({ booking, isNew }: BookingLiveCardProps) {
  const when = booking.scheduled_at || booking.service_datetime;
  const customerName = booking.user?.name || booking.user?.email || '—';
  const providerName = booking.assigned_driver
    ? booking.assigned_driver.name || booking.assigned_driver.email || 'Assigned'
    : null;
  const displayStatus = statusLabel[booking.status] || booking.status.replace(/_/g, ' ');
  const tracking = booking.tracking_status ? trackingLabel[booking.tracking_status] : null;
  const serviceLabel = booking.service_type?.replace(/_/g, ' ') ?? '—';

  return (
    <Link href={`/bookings/${booking.id}`}>
      <div
        className={`card group relative flex flex-col gap-3 transition-all hover:shadow-md hover:ring-1 hover:ring-primary-200 ${
          isNew ? 'ring-2 ring-primary animate-pulse-once' : ''
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-secondary-900">
              {booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`}
            </span>
            <Badge variant={statusVariant[booking.status] || 'neutral'} dot>
              {displayStatus}
            </Badge>
          </div>
          {tracking && (
            <Badge variant="primary" className="shrink-0 text-xs">
              {tracking}
            </Badge>
          )}
        </div>

        {/* Customer & Provider */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-1.5">
            <UserIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <div className="min-w-0">
              <p className="text-xs text-neutral-300">Customer</p>
              <p className="truncate text-sm font-medium text-secondary-900">{customerName}</p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <WrenchScrewdriverIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <div className="min-w-0">
              <p className="text-xs text-neutral-300">Provider</p>
              <p className="truncate text-sm font-medium text-secondary-900">
                {providerName ?? <span className="text-neutral-200 font-normal">Unassigned</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2.5">
          <span className="inline-flex items-center gap-1 text-xs text-neutral-300">
            <WrenchScrewdriverIcon className="h-3 w-3" />
            {serviceLabel}
          </span>
          {when && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-300">
              <ClockIcon className="h-3 w-3" />
              {formatDate(when, 'MMM d, h:mm a')}
            </span>
          )}
          {booking.total_price && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-700">
              <CurrencyDollarIcon className="h-3 w-3" />
              {parseFloat(booking.total_price).toFixed(2)}
            </span>
          )}
          {booking.address && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-300 max-w-[160px] truncate">
              <MapPinIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{booking.address}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
