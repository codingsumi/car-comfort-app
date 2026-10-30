'use client';

import { APP_MAP_COLORS } from '@/lib/mapboxConfig';
import { TruckIcon, MapPinIcon } from '@heroicons/react/24/solid';

/** Customer / destination pin — brand red teardrop like the mobile app. */
export function CustomerMapPin({
  label,
  onClick,
  selected = false,
}: {
  label?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none select-none"
      style={{ transform: 'translate(-50%, -100%)' }}
      aria-label={label ? `Customer location ${label}` : 'Customer location'}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg ring-2 transition-transform"
        style={{
          backgroundColor: APP_MAP_COLORS.brandRed,
          borderColor: selected ? APP_MAP_COLORS.navPill : APP_MAP_COLORS.pinBorder,
          boxShadow: selected
            ? '0 0 0 3px rgba(44, 44, 46, 0.35), 0 4px 14px rgba(228, 16, 31, 0.45)'
            : '0 4px 14px rgba(228, 16, 31, 0.45)',
          transform: selected ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <MapPinIcon className="h-5 w-5 text-white" />
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `8px solid ${APP_MAP_COLORS.brandRed}`,
        }}
      />
      {label ? (
        <span className="mt-1 max-w-[88px] truncate rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white">
          {label}
        </span>
      ) : null}
    </button>
  );
}

/** Provider / vehicle pin — dark circle with car icon like the driver map. */
export function ProviderMapPin({
  label,
  selected = false,
  pulse = false,
  onClick,
}: {
  label?: string;
  selected?: boolean;
  pulse?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="relative flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 outline-none select-none"
      style={{ transform: 'translate(-50%, -100%)' }}
      aria-label={label ? `Provider ${label}` : 'Service provider'}
    >
      {pulse ? (
        <span className="pointer-events-none absolute top-1 h-10 w-10 animate-ping rounded-full bg-black/25" />
      ) : null}
      <div
        className="relative flex h-10 w-10 items-center justify-center rounded-full shadow-lg ring-2 transition-transform"
        style={{
          backgroundColor: APP_MAP_COLORS.navPill,
          borderColor: selected ? APP_MAP_COLORS.brandRed : APP_MAP_COLORS.pinBorder,
          boxShadow: selected
            ? '0 0 0 3px rgba(228, 16, 31, 0.35), 0 4px 12px rgba(0,0,0,0.35)'
            : '0 4px 12px rgba(0,0,0,0.3)',
          transform: selected ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <TruckIcon className="h-5 w-5 text-white" />
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `8px solid ${APP_MAP_COLORS.navPill}`,
        }}
      />
      {label ? (
        <span className="mt-1 max-w-[96px] truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-secondary-900 shadow-md ring-1 ring-neutral-100">
          {label}
        </span>
      ) : null}
    </button>
  );
}
