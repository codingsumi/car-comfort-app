'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox';
import Link from 'next/link';
import type { FleetMapBooking } from '@/types';
import {
  APP_MAP_COLORS,
  APP_MAP_STYLE,
  configureMapboxWorker,
  getMapboxToken,
} from '@/lib/mapboxConfig';
import { MapRecenterButton } from '@/components/map/MapRecenterButton';
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  UserPlusIcon,
  TruckIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { AssignProviderModal } from '@/components/bookings/AssignProviderModal';

const DEFAULT_CENTER = { latitude: 37.7749, longitude: -122.4194 };

// ── Status colour map ──────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  pending_payment: { bg: '#8B5CF6', label: 'Pending Payment' },
  confirmed:       { bg: '#F59E0B', label: 'Confirmed' },
  assigned:        { bg: '#3B82F6', label: 'Assigned' },
  on_the_way:      { bg: '#06B6D4', label: 'On The Way' },
  arrived:         { bg: '#10B981', label: 'Arrived' },
  in_progress:     { bg: '#22C55E', label: 'In Service' },
  service_started: { bg: '#22C55E', label: 'In Service' },
  completed:       { bg: '#6B7280', label: 'Completed' },
  cancelled:       { bg: '#EF4444', label: 'Cancelled' },
  refunded:        { bg: '#EF4444', label: 'Refunded' },
  failed:          { bg: '#DC2626', label: 'Failed' },
  disputed:        { bg: '#F97316', label: 'Disputed' },
};

function resolveStatusColor(booking: FleetMapBooking): string {
  // tracking_status takes precedence for active jobs
  if (booking.tracking_status === 'on_the_way') return STATUS_COLORS.on_the_way.bg;
  if (booking.tracking_status === 'arrived')    return STATUS_COLORS.arrived.bg;
  if (booking.tracking_status === 'service_started') return STATUS_COLORS.service_started.bg;
  return STATUS_COLORS[booking.status]?.bg ?? '#6B7280';
}

function resolveStatusLabel(booking: FleetMapBooking): string {
  if (booking.tracking_status === 'on_the_way') return 'On The Way';
  if (booking.tracking_status === 'arrived')    return 'Arrived';
  if (booking.tracking_status === 'service_started') return 'In Service';
  return STATUS_COLORS[booking.status]?.label ?? booking.status;
}

// ── Map pins ───────────────────────────────────────────────────────────────

function ProviderPin({
  label, color, selected, pulse, onClick,
}: {
  label: string; color: string; selected: boolean; pulse: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="relative flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none select-none"
      style={{ transform: 'translate(-50%, -100%)' }}
    >
      {pulse && (
        <span
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full animate-ping opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg ring-2 ring-white transition-transform"
        style={{
          backgroundColor: color,
          transform: selected ? 'scale(1.15)' : 'scale(1)',
          boxShadow: selected ? `0 0 0 3px ${color}55, 0 4px 14px ${color}66` : `0 4px 12px ${color}44`,
        }}
      >
        <TruckIcon className="h-4 w-4 text-white" />
      </div>
      <span className="mt-1 max-w-[88px] truncate rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
        {label}
      </span>
    </button>
  );
}

function CustomerPin({
  label, selected, onClick,
}: {
  label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none select-none"
      style={{ transform: 'translate(-50%, -100%)' }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full shadow-lg ring-2 ring-white transition-transform"
        style={{
          backgroundColor: APP_MAP_COLORS.brandRed,
          transform: selected ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        <MapPinIcon className="h-4 w-4 text-white" />
      </div>
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `7px solid ${APP_MAP_COLORS.brandRed}` }} />
      <span className="mt-0.5 max-w-[88px] truncate rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
        {label}
      </span>
    </button>
  );
}

// ── Popup card ─────────────────────────────────────────────────────────────

function BookingPopupCard({
  booking, anchor, onClose, onAssigned,
}: {
  booking: FleetMapBooking;
  anchor: 'provider' | 'customer';
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const label = booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
  const color = resolveStatusColor(booking);
  const statusLabel = resolveStatusLabel(booking);

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xl">
      <div className="px-4 py-3" style={{ borderTop: `4px solid ${color}` }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-bold text-secondary-900">{label}</p>
            <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>
              {statusLabel}
            </span>
            <p className="mt-1 text-[10px] font-medium text-neutral-400">
              {anchor === 'provider' ? '📡 Live provider location' : '📍 Customer pickup location'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-50">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-neutral-400">Customer</span>
          <span className="truncate font-medium text-secondary-900">{booking.user?.name || '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-neutral-400">Provider</span>
          <span className="truncate font-medium text-secondary-900">{booking.provider?.name || 'Unassigned'}</span>
        </div>
        {booking.service_type && (
          <div className="flex justify-between gap-3">
            <span className="text-neutral-400">Service</span>
            <span className="truncate font-medium text-secondary-900">{booking.service_type.replace(/_/g, ' ')}</span>
          </div>
        )}
        {booking.address && (
          <div className="rounded-xl bg-[#F2F2F7] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Service address</p>
            <p className="mt-0.5 text-secondary-700">{booking.address}</p>
          </div>
        )}
        {booking.provider_location_at && anchor === 'provider' && (
          <p className="text-[10px] text-neutral-400">
            Updated {new Date(booking.provider_location_at).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2.5">
        <Link
          href={`/bookings/${booking.id}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-700"
        >
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          View details
        </Link>
        <button
          onClick={() => setAssignOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-secondary-700 hover:text-primary"
        >
          <UserPlusIcon className="h-3.5 w-3.5" />
          {booking.provider ? 'Reassign' : 'Assign'}
        </button>
      </div>

      {assignOpen && (
        <AssignProviderModal
          bookingId={booking.id}
          bookingLabel={label}
          currentProviderId={booking.provider?.id ?? null}
          currentProviderName={booking.provider?.name ?? null}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onAssigned={onAssigned}
        />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export type TrackingFilter = 'all' | 'on_the_way' | 'arrived' | 'in_service';
export type PopupAnchor = 'provider' | 'customer';

interface FleetMapViewProps {
  bookings: FleetMapBooking[];
  filter: TrackingFilter;
  onProviderLocationUpdate?: (bookingId: number, lat: number, lng: number) => void;
  onAssigned?: () => void;
}

export function FleetMapView({ bookings, filter, onAssigned }: FleetMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<PopupAnchor | null>(null);
  const [viewState, setViewState] = useState({ ...DEFAULT_CENTER, zoom: 11 });
  const hasFitted = useRef(false);
  const mapboxToken = getMapboxToken();

  useEffect(() => { configureMapboxWorker(); }, []);

  /** Best available pickup/service coordinate for bookings without a live provider location. */
  const pickupCoord = (b: FleetMapBooking): { lat: number; lng: number } | null => {
    if (b.customer_lat && b.customer_lng) return { lat: b.customer_lat, lng: b.customer_lng };
    if (b.service_lat && b.service_lng)   return { lat: b.service_lat!,  lng: b.service_lng! };
    if (b.charging_lat && b.charging_lng) return { lat: b.charging_lat!, lng: b.charging_lng! };
    return null;
  };

  const hasAnyCoord = (b: FleetMapBooking) =>
    !!(b.provider_lat && b.provider_lng) || !!pickupCoord(b);

  // Bookings visible on the map — must have at least one coordinate
  const visibleBookings = bookings.filter((b) => {
    if (!hasAnyCoord(b)) return false;
    if (filter === 'all') return true;
    if (filter === 'on_the_way') return b.tracking_status === 'on_the_way';
    if (filter === 'arrived') return b.tracking_status === 'arrived';
    if (filter === 'in_service') return b.tracking_status === 'service_started' || b.status === 'in_progress';
    return true;
  });

  const selectedBooking = selectedId ? visibleBookings.find((b) => b.id === selectedId) ?? null : null;

  const selectBooking = (bookingId: number, anchor: PopupAnchor) => {
    if (selectedId === bookingId && popupAnchor === anchor) { setSelectedId(null); setPopupAnchor(null); return; }
    setSelectedId(bookingId);
    setPopupAnchor(anchor);
  };

  const clearSelection = () => { setSelectedId(null); setPopupAnchor(null); };

  const popupPosition = (() => {
    if (!selectedBooking || !popupAnchor) return null;
    if (popupAnchor === 'provider' && selectedBooking.provider_lat && selectedBooking.provider_lng) {
      return { lat: selectedBooking.provider_lat, lng: selectedBooking.provider_lng };
    }
    // For pickup-pin popups (confirmed/completed) or customer anchor
    const pc = pickupCoord(selectedBooking);
    if (pc) return { lat: pc.lat, lng: pc.lng };
    return null;
  })();

  const fitToBookings = useCallback(() => {
    if (visibleBookings.length === 0) return;
    const allLats: number[] = [];
    const allLngs: number[] = [];
    for (const b of visibleBookings) {
      if (b.provider_lat) { allLats.push(b.provider_lat); allLngs.push(b.provider_lng!); }
      const pc = pickupCoord(b);
      if (pc) { allLats.push(pc.lat); allLngs.push(pc.lng); }
    }
    if (!allLats.length) return;
    mapRef.current?.fitBounds(
      [[Math.min(...allLngs), Math.min(...allLats)], [Math.max(...allLngs), Math.max(...allLats)]],
      { padding: 72, duration: 800, maxZoom: 14 }
    );
  }, [visibleBookings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasFitted.current || visibleBookings.length === 0) return;
    fitToBookings();
    hasFitted.current = true;
  }, [visibleBookings, fitToBookings]);

  if (!mapboxToken) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-[#F2F2F7] text-center">
        <p className="text-sm font-medium text-secondary-900">Mapbox token not configured</p>
        <p className="max-w-xs text-xs text-neutral-400">Set <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the live fleet map.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl" style={{ minHeight: 520 }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        onLoad={(e) => { e.target.resize(); if (!hasFitted.current && visibleBookings.length > 0) fitToBookings(); }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={APP_MAP_STYLE}
        mapboxAccessToken={mapboxToken}
        onClick={clearSelection}
      >
        {/* ── LIVE PROVIDER markers — assigned/in_progress with GPS ── */}
        {visibleBookings
          .filter((b) => b.provider_lat && b.provider_lng)
          .map((booking) => {
            const color = resolveStatusColor(booking);
            const label = booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
            const isSelected = selectedId === booking.id && popupAnchor === 'provider';
            const isMoving = booking.tracking_status === 'on_the_way';
            return (
              <Marker key={`prov-${booking.id}`} latitude={booking.provider_lat!} longitude={booking.provider_lng!} anchor="bottom">
                <ProviderPin label={label} color={color} selected={isSelected} pulse={isMoving}
                  onClick={() => selectBooking(booking.id, 'provider')} />
              </Marker>
            );
          })}

        {/* ── CUSTOMER PICKUP markers — confirmed / completed (no live GPS) ──
             Show the customer’s pickup/service location so the map is never
             blank for these bookings. Only rendered when there is NO provider
             live location (to avoid a duplicate pin at the same spot). */}
        {visibleBookings
          .filter((b) => !(b.provider_lat && b.provider_lng)) // skip if already has live pin
          .map((booking) => {
            const pc = pickupCoord(booking);
            if (!pc) return null;
            const label = booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
            const isSelected = selectedId === booking.id && popupAnchor === 'customer';
            return (
              <Marker key={`pickup-${booking.id}`} latitude={pc.lat} longitude={pc.lng} anchor="bottom">
                <CustomerPin label={label} selected={isSelected}
                  onClick={() => selectBooking(booking.id, 'customer')} />
              </Marker>
            );
          })}

        {/* ── CUSTOMER destination pin for ACTIVE bookings (when provider is not yet at pickup) ── */}
        {visibleBookings
          .filter((b) => {
            if (!b.provider_lat || !b.provider_lng) return false; // already handled above
            const pc = pickupCoord(b);
            if (!pc) return false;
            // Suppress if provider is within ~10m of pickup (arrived)
            const latDiff = Math.abs(b.provider_lat - pc.lat);
            const lngDiff = Math.abs(b.provider_lng - pc.lng);
            return !(latDiff < 0.0001 && lngDiff < 0.0001);
          })
          .map((booking) => {
            const pc = pickupCoord(booking)!;
            const label = booking.booking_code ? `#${booking.booking_code}` : `#${booking.id}`;
            const isSelected = selectedId === booking.id && popupAnchor === 'customer';
            return (
              <Marker key={`cust-${booking.id}`} latitude={pc.lat} longitude={pc.lng} anchor="bottom">
                <CustomerPin label={label} selected={isSelected}
                  onClick={() => selectBooking(booking.id, 'customer')} />
              </Marker>
            );
          })}

        {/* ── Popup ── */}
        {selectedBooking && popupPosition && (
          <Popup
            latitude={popupPosition.lat}
            longitude={popupPosition.lng}
            anchor="bottom"
            offset={32}
            closeButton={false}
            closeOnClick={false}
            onClose={clearSelection}
            className="!z-20 !p-0 !rounded-2xl !shadow-none !border-0 [&_.mapboxgl-popup-content]:!p-0 [&_.mapboxgl-popup-content]:!rounded-2xl [&_.mapboxgl-popup-content]:!shadow-none [&_.mapboxgl-popup-tip]:!hidden"
          >
            <BookingPopupCard
              booking={selectedBooking}
              anchor={popupAnchor ?? 'provider'}
              onClose={clearSelection}
              onAssigned={onAssigned}
            />
          </Popup>
        )}
      </Map>

      <MapRecenterButton onClick={fitToBookings} className="absolute bottom-4 right-4 z-10" />
    </div>
  );
}
