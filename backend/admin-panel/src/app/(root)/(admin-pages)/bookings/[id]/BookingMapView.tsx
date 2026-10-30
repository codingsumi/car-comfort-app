'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Map, {
  Marker,
  Source,
  Layer,
  type LayerProps,
  type MapRef,
} from 'react-map-gl/mapbox';
import { useSocket } from '@/hooks/useSocket';
import { bookingsService } from '@/services/bookings.service';
import {
  APP_MAP_COLORS,
  APP_MAP_STYLE,
  APP_ROUTE_LINE,
  configureMapboxWorker,
  getMapboxToken,
} from '@/lib/mapboxConfig';
import { CustomerMapPin, ProviderMapPin } from '@/components/map/AppMapMarkers';
import { MapRecenterButton } from '@/components/map/MapRecenterButton';

interface DriverLocation {
  id: number;
  lat: string;
  lng: string;
  created_at: string;
}

interface BookingMapViewProps {
  bookingId: number;
  customerLat: number | null;
  customerLng: number | null;
  driverLocations: DriverLocation[];
}

const DEFAULT_VIEW = { latitude: 37.7749, longitude: -122.4194, zoom: 13 };

const routeLayer: LayerProps = {
  id: 'route',
  type: 'line',
  paint: {
    'line-color': APP_ROUTE_LINE.color,
    'line-width': APP_ROUTE_LINE.width,
    'line-opacity': APP_ROUTE_LINE.opacity,
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
};

export default function BookingMapView({
  bookingId,
  customerLat,
  customerLng,
  driverLocations,
}: BookingMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [providerPosition, setProviderPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const hasInitialized = useRef(false);
  const mapboxToken = getMapboxToken();

  useEffect(() => {
    configureMapboxWorker();
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (driverLocations.length > 0) {
      const latest = driverLocations[0];
      const lat = parseFloat(latest.lat);
      const lng = parseFloat(latest.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setProviderPosition({ lat, lng });
        setLocationUpdatedAt(new Date(latest.created_at));
        hasInitialized.current = true;
      }
    }
  }, [driverLocations]);

  const fitToTrip = useCallback(() => {
    const points: [number, number][] = [];
    if (providerPosition) points.push([providerPosition.lng, providerPosition.lat]);
    if (customerLat && customerLng) points.push([customerLng, customerLat]);
    driverLocations.forEach((loc) => {
      const lat = parseFloat(loc.lat);
      const lng = parseFloat(loc.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lng, lat]);
    });
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current?.flyTo({ center: points[0], zoom: 14, duration: 700 });
      return;
    }
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, duration: 700, maxZoom: 15 }
    );
  }, [providerPosition, customerLat, customerLng, driverLocations]);

  useEffect(() => {
    if (providerPosition || (customerLat && customerLng)) {
      fitToTrip();
    }
  }, [providerPosition, customerLat, customerLng, fitToTrip]);

  const fetchLocation = useCallback(async () => {
    try {
      const res = await bookingsService.getProviderLocation(bookingId);
      const loc = res.data.data;
      if (loc?.lat && loc?.lng) {
        const lat = parseFloat(loc.lat);
        const lng = parseFloat(loc.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setProviderPosition({ lat, lng });
          setLocationUpdatedAt(new Date());
          hasInitialized.current = true;
        }
      }
    } catch {
      // ignore
    }
  }, [bookingId]);

  useEffect(() => {
    fetchLocation();
    const id = setInterval(fetchLocation, 30000);
    return () => clearInterval(id);
  }, [fetchLocation]);

  const handleLocationUpdate = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as { booking_id?: number; lat?: number; lng?: number };
      if (p.booking_id !== bookingId) return;
      if (p.lat == null || p.lng == null) return;
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setProviderPosition({ lat, lng });
      setLocationUpdatedAt(new Date());
      hasInitialized.current = true;
    },
    [bookingId]
  );

  const { connected } = useSocket({ provider_location_updated: handleLocationUpdate });

  const customerPosition =
    customerLat && customerLng && Number.isFinite(customerLat) && Number.isFinite(customerLng)
      ? { lat: customerLat, lng: customerLng }
      : null;

  const routeCoords = [...driverLocations]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((loc) => [parseFloat(loc.lng), parseFloat(loc.lat)] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));

  const routeGeoJson = {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: routeCoords },
    properties: {},
  };

  if (!mapboxToken) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl bg-[#F2F2F7] text-center">
        <span className="text-3xl">🗺️</span>
        <p className="text-sm font-medium text-secondary-900">Mapbox token not configured</p>
        <p className="text-xs text-neutral-400">
          Set <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable GPS tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-semibold text-success">Live tracking</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-neutral-300" />
              <span className="text-neutral-400">Polling every 30s</span>
            </>
          )}
        </div>
        {locationUpdatedAt ? (
          <span className="text-xs text-neutral-400">
            Updated {locationUpdatedAt.toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      {!providerPosition && !customerPosition ? (
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-[#F2F2F7]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <span className="text-2xl">📡</span>
          </div>
          <p className="text-sm font-medium text-secondary-900">Waiting for GPS signal</p>
          <p className="text-xs text-neutral-400">
            Provider location will appear once they start moving.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-neutral-100 shadow-sm" style={{ height: 420 }}>
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(e) => setViewState(e.viewState)}
            onLoad={(e) => {
              e.target.resize();
              fitToTrip();
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={APP_MAP_STYLE}
            mapboxAccessToken={mapboxToken}
          >
            {routeCoords.length > 1 ? (
              <Source id="route" type="geojson" data={routeGeoJson}>
                <Layer {...routeLayer} />
              </Source>
            ) : null}

            {customerPosition ? (
              <Marker latitude={customerPosition.lat} longitude={customerPosition.lng} anchor="bottom">
                <CustomerMapPin label="Customer" />
              </Marker>
            ) : null}

            {providerPosition ? (
              <Marker latitude={providerPosition.lat} longitude={providerPosition.lng} anchor="bottom">
                <ProviderMapPin label="Provider" pulse={connected} />
              </Marker>
            ) : null}
          </Map>

          <MapRecenterButton onClick={fitToTrip} className="absolute bottom-4 right-4 z-10" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#F2F2F7] px-4 py-2.5 text-xs text-secondary-700">
        {customerPosition ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: APP_MAP_COLORS.brandRed }} />
            <span>Customer</span>
          </div>
        ) : null}
        {providerPosition ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: APP_MAP_COLORS.navPill }} />
            <span>Provider (live)</span>
          </div>
        ) : null}
        {routeCoords.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="h-1 w-5 rounded-full bg-black" />
            <span>Route history</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
