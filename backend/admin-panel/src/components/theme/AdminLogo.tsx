'use client';

import Image from 'next/image';
import { useAdminThemeStore } from '@/store/adminTheme';
import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/paths';

interface AdminLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  subtitle?: string;
  className?: string;
  inverted?: boolean;
}

const sizeMap = {
  sm: { box: 'h-8 w-8', text: 'text-sm', img: 32 },
  md: { box: 'h-10 w-10', text: 'text-lg', img: 40 },
  lg: { box: 'h-12 w-12', text: 'text-xl', img: 48 },
};

export function AdminLogo({ size = 'md', showName = true, subtitle, className, inverted }: AdminLogoProps) {
  const branding = useAdminThemeStore((s) => s.branding);
  const sizes = sizeMap[size];
  const initials = branding.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {branding.logo ? (
        <div className={cn('relative flex-shrink-0 overflow-hidden rounded-lg', sizes.box)}>
          <Image
            src={resolveMediaUrl(branding.logo)}
            alt={branding.name}
            width={sizes.img}
            height={sizes.img}
            className="h-full w-full object-contain"
            unoptimized
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary)]',
            sizes.box
          )}
        >
          <span className={cn('font-bold text-white', sizes.text)}>{initials}</span>
        </div>
      )}
      {showName && (
        <div>
          <span
            className={cn(
              'font-bold',
              sizes.text,
              inverted ? 'text-white' : 'text-secondary-900 dark:text-white'
            )}
          >
            {branding.name}
          </span>
          {subtitle && (
            <p
              className={cn(
                'text-[10px] font-medium uppercase tracking-wider',
                inverted ? 'text-neutral-300' : 'text-neutral-300'
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
