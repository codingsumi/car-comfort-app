'use client';

import { MapPinIcon } from '@heroicons/react/24/solid';

interface MapRecenterButtonProps {
  onClick: () => void;
  className?: string;
}

/** Black circular FAB — matches the mobile app recenter control. */
export function MapRecenterButton({ onClick, className = '' }: MapRecenterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Recenter map"
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-lg transition hover:bg-secondary-700 active:scale-95 ${className}`}
    >
      <MapPinIcon className="h-5 w-5" />
    </button>
  );
}
