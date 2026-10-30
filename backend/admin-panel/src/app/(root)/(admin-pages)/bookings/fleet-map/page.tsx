'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { useSocket } from '@/hooks/useSocket';
import { PageHeader } from '@/components/shared/PageHeader';
import { STATUS_COLORS } from '@/components/bookings/FleetMapView';
import type { FleetMapBooking, FleetMapFilters } from '@/types';
import {
  ArrowPathIcon,
  MapPinIcon,
  SignalSlashIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const FleetMapView = dynamic(
  () => import('@/components/bookings/FleetMapView').then((m) => m.FleetMapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    ),
  }
);

// ── Status tab definitions ─────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',                label: 'All' },
  { key: 'pending_payment', label: 'Pending Payment' },
  { key: 'confirmed',       label: 'Confirmed' },
  { key: 'assigned',        label: 'Assigned' },
  { key: 'in_progress',     label: 'In Service' },
  { key: 'completed',       label: 'Completed' },
  { key: 'cancelled',       label: 'Cancelled' },
  { key: 'refunded',        label: 'Refunded' },
  { key: 'disputed',        label: 'Disputed' },
] as const;

type StatusTab = typeof STATUS_TABS[number]['key'];

// ── Socket indicator ───────────────────────────────────────────────────────

function SocketIndicator({ connected, lastUpdated }: { connected: boolean; lastUpdated: Date | null }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!lastUpdated) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 5) return setElapsed('just now');
      if (secs < 60) return setElapsed(`${secs}s ago`);
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
          <span className="font-medium text-success">Live</span>
        </>
      ) : (
        <>
          <SignalSlashIcon className="h-3.5 w-3.5 text-neutral-300" />
          <span className="text-neutral-300">Disconnected</span>
        </>
      )}
      {elapsed && <span className="text-neutral-200">· {elapsed}</span>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FleetMapPage() {
  const queryClient = useQueryClient();

  // Active tab — filters which bookings are shown on map
  const [activeTab, setActiveTab] = useState<StatusTab>('');

  const [mapBookings, setMapBookings] = useState<FleetMapBooking[]>([]);

  // ── MAP query — defaults to active only (backend excludes historical) ──
  // assigned/in_progress → live provider GPS pin
  // confirmed (no provider yet) → customer pickup pin fallback
  // NOTE: completed/cancelled/refunded are NOT fetched by default — the backend
  // actively filters them out. If a tab requests historical statuses, the
  // frontend appends them to the query string so the backend respects the explicit filter.
  const activeApiFilters = useMemo<FleetMapFilters>(() => {
    const base = { limit: 500 };
    // If a historical tab is active (completed, cancelled, refunded), append it explicitly
    // so the backend doesn't silently filter it out.
    if (activeTab === 'completed' || activeTab === 'cancelled' || activeTab === 'refunded') {
      return { ...base, status: activeTab };
    }
    return base;
  }, [activeTab]);

  const { data: mapData, isLoading: mapLoading, isFetching: mapFetching, refetch: refetchMap } = useQuery({
    queryKey: ['fleet-map-active', activeApiFilters],
    queryFn: () => bookingsService.getFleetMap(activeApiFilters).then((r) => r.data.data),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (mapData?.bookings) setMapBookings(mapData.bookings);
  }, [mapData]);

  // ── Counts query — ALL statuses for accurate tab counts ──────────────
  // Backend excludes historical by default, so we pass an explicit status list
  // to get counts for every tab (active + historical) in a single round-trip.
  const ALL_STATUS_LIST = 'pending_payment,confirmed,assigned,in_progress,completed,cancelled,refunded,failed,disputed';

  const { data: countsData } = useQuery({
    queryKey: ['fleet-map-counts'],
    queryFn: () =>
      bookingsService.getFleetMap({ status: ALL_STATUS_LIST, limit: 500 }).then((r) => r.data.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const tabCounts = useMemo(() => {
    const all = countsData?.bookings ?? [];
    const counts: Record<string, number> = { '': countsData?.total ?? all.length };
    for (const tab of STATUS_TABS.slice(1)) {
      counts[tab.key] = all.filter((b) => b.status === tab.key).length;
    }
    return counts;
  }, [countsData]);

  // Socket — patch provider location in real time
  const patchLocation = useCallback((bookingId: number, lat: number, lng: number) => {
    setMapBookings((prev) =>
      prev.map((b) => b.id === bookingId
        ? { ...b, provider_lat: lat, provider_lng: lng, provider_location_at: new Date().toISOString() }
        : b
      )
    );
  }, []);

  const handleSocketEvent = useCallback(
    (eventName: string) => (payload: unknown) => {
      if (eventName === 'provider_location_updated' && payload && typeof payload === 'object') {
        const p = payload as { booking_id?: number; lat?: number; lng?: number };
        if (p.booking_id && p.lat != null && p.lng != null) { patchLocation(p.booking_id, p.lat, p.lng); return; }
      }
      queryClient.invalidateQueries({ queryKey: ['fleet-map-active'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-map-counts'] });
    },
    [queryClient, patchLocation]
  );

  const { connected, lastUpdated } = useSocket({
    booking_created:           handleSocketEvent('booking_created'),
    booking_updated:           handleSocketEvent('booking_updated'),
    booking_cancelled:         handleSocketEvent('booking_cancelled'),
    provider_location_updated: handleSocketEvent('provider_location_updated'),
  });

  // A booking is placeable on the map if it has ANY usable coordinate:
  // - live provider GPS (assigned/in_progress)
  // - OR customer pickup lat/lng (confirmed/completed fallback)
  // - OR service/charging lat/lng as last resort
  const hasMapLocation = (b: FleetMapBooking) =>
    !!(b.provider_lat && b.provider_lng) ||
    !!(b.customer_lat && b.customer_lng) ||
    !!(b.service_lat && b.service_lng) ||
    !!(b.charging_lat && b.charging_lng);

  // Bookings visible on map — filtered by active tab
  const mapVisible = useMemo(() => {
    let list = mapBookings.filter(hasMapLocation);
    if (activeTab) list = list.filter((b) => b.status === activeTab);
    return list;
  }, [mapBookings, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking sub-counts (live GPS only, for the pill counters)
  const trackingCounts = useMemo(() => {
    const live = mapBookings.filter((b) => b.provider_lat && b.provider_lng);
    return {
      on_the_way: live.filter((b) => b.tracking_status === 'on_the_way').length,
      arrived:    live.filter((b) => b.tracking_status === 'arrived').length,
      in_service: live.filter((b) => b.tracking_status === 'service_started' || b.status === 'in_progress').length,
    };
  }, [mapBookings]);

  const totalBookings = countsData?.total ?? 0;
  // Live = provider GPS present; pickup = customer lat only
  const liveOnMap   = mapBookings.filter((b) => b.provider_lat && b.provider_lng).length;
  const pickupOnMap = mapBookings.filter((b) => !b.provider_lat && hasMapLocation(b)).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Live Map"
        description={`${liveOnMap} live tracking · ${pickupOnMap} pickup pins · ${totalBookings} total bookings`}
      />

      {/* ── Status tabs + refresh bar ────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs — moved here from below map */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_TABS.map(({ key, label }) => {
            const count = tabCounts[key] ?? 0;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as StatusTab)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-neutral-200 bg-white text-secondary-700 hover:border-primary hover:text-primary'
                }`}
              >
                {key && (
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[key]?.bg ?? '#6B7280' }}
                  />
                )}
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live indicator + tracking counts + refresh */}
        <div className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-neutral-100 bg-white px-3 py-2 shadow-sm">
          {/* Tracking sub-counts */}
          <div className="hidden items-center gap-3 text-xs sm:flex">
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.on_the_way.bg }} />
              On Way <strong className="text-secondary-900">{trackingCounts.on_the_way}</strong>
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.arrived.bg }} />
              Arrived <strong className="text-secondary-900">{trackingCounts.arrived}</strong>
            </span>
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.in_progress.bg }} />
              In Service <strong className="text-secondary-900">{trackingCounts.in_service}</strong>
            </span>
            <span className="text-neutral-200">|</span>
          </div>
          <SocketIndicator connected={connected} lastUpdated={lastUpdated} />
          <button
            onClick={() => { void refetchMap(); }}
            disabled={mapFetching}
            className="flex items-center gap-1 text-xs font-medium text-secondary-700 hover:text-primary disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${mapFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Map card ─────────────────────────────────────────────────── */}
      <div className="relative h-[calc(100vh-320px)] min-h-[520px] overflow-hidden rounded-2xl border border-neutral-100 border-t-4 border-t-primary bg-white shadow-md">
        {mapLoading ? (
          <div className="flex h-full items-center justify-center bg-neutral-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
              <p className="text-sm text-neutral-300">Loading active bookings…</p>
            </div>
          </div>
        ) : mapVisible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-50 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <MapPinIcon className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-secondary-900">
              {activeTab ? `No active ${activeTab.replace(/_/g, ' ')} bookings on map` : 'No active jobs on the map right now'}
            </p>
            <p className="text-xs text-neutral-400">Bookings appear here once a provider is assigned and broadcasting location.</p>
          </div>
        ) : (
          <FleetMapView
            bookings={mapVisible}
            filter="all"
            onProviderLocationUpdate={patchLocation}
          />
        )}

        {/* Active on map badge */}
        {mapVisible.length > 0 && (
          <div className="absolute bottom-[170px] right-3 z-10 flex items-center gap-1.5 rounded-full border border-neutral-100 bg-white/95 px-3 py-1.5 text-xs font-semibold text-secondary-900 shadow-lg backdrop-blur-sm">
            <BoltIcon className="h-3.5 w-3.5 text-primary" />
            {liveOnMap} live · {pickupOnMap} pickup
          </div>
        )}
      </div>

      {/* ── Legend card below map ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
        <p className="mr-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Map Legend</p>
        {[
          { color: STATUS_COLORS.confirmed.bg,   label: 'Confirmed' },
          { color: STATUS_COLORS.assigned.bg,    label: 'Assigned' },
          { color: STATUS_COLORS.on_the_way.bg,  label: 'On The Way' },
          { color: STATUS_COLORS.arrived.bg,     label: 'Arrived' },
          { color: STATUS_COLORS.in_progress.bg, label: 'In Service' },
          { color: '#E4101F', label: 'Customer pickup (confirmed / completed)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-secondary-700">
            <span className="h-3 w-3 flex-shrink-0 rounded-full shadow-sm ring-1 ring-white/60" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
