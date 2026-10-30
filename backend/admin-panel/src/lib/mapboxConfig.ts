/** Matches mobile app MapWidget default — vibrant streets, not the dull light style. */
export const APP_MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

export const APP_MAP_COLORS = {
  brandRed: '#E4101F',
  brandRedDark: '#C4101F',
  routeLine: '#000000',
  navPill: '#2C2C2E',
  sheetBg: '#F2F2F7',
  pinBorder: '#FFFFFF',
} as const;

export const APP_ROUTE_LINE = {
  color: APP_MAP_COLORS.routeLine,
  width: 5,
  opacity: 0.95,
} as const;

export function getMapboxToken(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ''
  );
}

/** Client-only — avoids pulling mapbox-gl into the server bundle. */
export function configureMapboxWorker(): void {
  if (typeof window === 'undefined') return;
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '/admin').replace(/\/$/, '');
  void import('mapbox-gl').then((mod) => {
    mod.default.workerUrl = `${basePath}/mapbox-gl-csp-worker.js`;
  });
}
