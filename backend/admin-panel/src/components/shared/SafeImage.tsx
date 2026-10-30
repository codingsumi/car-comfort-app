'use client';

import NextImage from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { resolveMediaUrl } from '@/lib/paths';

export interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  /** Shown when primary `src` fails to load */
  fallbackSrc?: string;
  width?: number;
  height?: number;
  /** Parent must be `relative` with explicit dimensions */
  fill?: boolean;
  sizes?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * next/image wrapper for admin-uploaded or API URLs (arbitrary hosts).
 * Uses `unoptimized` to avoid remotePatterns maintenance; optional fallback on error.
 */
export function SafeImage({
  src,
  alt,
  fallbackSrc,
  width = 64,
  height = 64,
  fill,
  sizes,
  className,
  onClick,
}: SafeImageProps) {
  const initial = resolveMediaUrl(src || fallbackSrc);
  const [imgSrc, setImgSrc] = useState(initial);

  useEffect(() => {
    setImgSrc(resolveMediaUrl(src || fallbackSrc));
  }, [src, fallbackSrc]);

  const handleError = useCallback(() => {
    if (fallbackSrc && imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
  }, [fallbackSrc, imgSrc]);

  if (!imgSrc) return null;

  if (fill) {
    return (
      <NextImage
        src={imgSrc}
        alt={alt}
        fill
        sizes={sizes ?? '256px'}
        className={className}
        unoptimized
        onClick={onClick}
        onError={handleError}
      />
    );
  }

  return (
    <NextImage
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      unoptimized
      onClick={onClick}
      onError={handleError}
    />
  );
}
