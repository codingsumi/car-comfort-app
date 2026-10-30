'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { useSocket } from '@/hooks/useSocket';
import { BookingLiveCard } from './BookingLiveCard';
import type { Booking, BookingDashboardStats } from '@/types';
import {
  BoltIcon,
  ArrowPathIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';

// ── Status filter groups ────────────────────────────────────────────────────

interface FilterGroup {
  key: string;
  label: string;
  statuses: string[];
  statsKey: keyof BookingDashboardStats | null;
}

const FILTER_GROUPS: FilterGroup[] = [
  { key: 'all',       label: 'All',       statuses: [],                                          statsKey: null },
  { key: 'pending',   label: 'Pending',   statuses: ['pending_payment', 'confirmed'],             statsKey: 'pending' },
  { key: 'active',    label: 'Active',    statuses: ['assigned', 'in_progress'],                 statsKey: 'active' },
  { key: 'completed', label: 'Completed', statuses: ['completed'],                               statsKey: 'completed_today' },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'refunded', 'failed'],         statsKey: 'cancelled_today' },
  { key: 'disputed',  label: 'Disputed',  statuses: ['disputed'],                                statsKey: 'disputed' },
];

// ── Socket indicator ───────────────────────────────────────────────────────

interface SocketIndicatorProps {
  connected: boolean;
  lastUpdated: Date | null;
}

function SocketIndicator({ connected, lastUpdated }: SocketIndicatorProps) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!lastUpdated) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 5)  { setElapsed('just now'); return; }
      if (secs < 60) { setElapsed(`${secs}s ago`); return; }
      setElapsed(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div className="flex items-center gap-2 text-xs">
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-success font-medium">Live</span>
        </>
      ) : (
        <>
          <SignalSlashIcon className="h-3.5 w-3.5 text-neutral-300" />
          <span className="text-neutral-300">Disconnected</span>
        </>
      )}
      {lastUpdated && elapsed && (
        <span className="text-neutral-200">· Updated {elapsed}</span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface BookingLiveViewProps {
  stats?: BookingDashboardStats;
}

export function BookingLiveView({ stats }: BookingLiveViewProps) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('active');
  const newBookingIds = useRef<Set<number>>(new Set());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const activeGroup = FILTER_GROUPS.find((g) => g.key === activeFilter) ?? FILTER_GROUPS[0];
  const statusParam = activeGroup.statuses.length
    ? activeGroup.statuses.join(',')
    : undefined;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['live-bookings', activeFilter],
    queryFn: () =>
      bookingsService
        .list({ status: statusParam, limit: 100, sort: 'created_at', order: 'desc' })
        .then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const bookings: Booking[] = data?.rows ?? [];

  const handleSocketEvent = useCallback(
    (eventName: string) =>
      (payload: unknown) => {
        queryClient.invalidateQueries({ queryKey: ['live-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
        // Highlight newly created bookings
        if (eventName === 'booking_created' && payload && typeof payload === 'object') {
          const id = (payload as { id?: number }).id;
          if (id) {
            newBookingIds.current.add(id);
            setNewIds(new Set(newBookingIds.current));
            setTimeout(() => {
              newBookingIds.current.delete(id);
              setNewIds(new Set(newBookingIds.current));
            }, 8000);
          }
        }
      },
    [queryClient]
  );

  const { connected, lastUpdated } = useSocket({
    booking_created:           handleSocketEvent('booking_created'),
    booking_updated:           handleSocketEvent('booking_updated'),
    booking_cancelled:         handleSocketEvent('booking_cancelled'),
    refund_processed:          handleSocketEvent('refund_processed'),
    provider_location_updated: handleSocketEvent('provider_location_updated'),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar: filter tabs + socket indicator + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((group) => {
            const count =
              group.statsKey && stats ? Number(stats[group.statsKey] ?? 0) : undefined;
            const isActive = activeFilter === group.key;
            return (
              <button
                key={group.key}
                onClick={() => setActiveFilter(group.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-neutral-100 bg-white text-neutral-300 hover:border-primary-200 hover:text-primary'
                }`}
              >
                {group.label}
                {count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: socket indicator + refresh */}
        <div className="flex items-center gap-3">
          <SocketIndicator connected={connected} lastUpdated={lastUpdated} />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1 text-xs text-neutral-300 hover:text-primary disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-36 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BoltIcon className="h-10 w-10 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-300">No bookings in this category</p>
          <p className="text-xs text-neutral-200">
            {activeFilter === 'active'
              ? 'Active bookings will appear here in real-time.'
              : 'Try a different filter or check back later.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bookings.map((booking) => (
            <BookingLiveCard
              key={booking.id}
              booking={booking}
              isNew={newIds.has(booking.id)}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {bookings.length > 0 && (
        <p className="text-xs text-neutral-200 text-right">
          Showing {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
          {bookings.length === 100 ? ' (max 100 — use table view for full list)' : ''}
        </p>
      )}
    </div>
  );
}
