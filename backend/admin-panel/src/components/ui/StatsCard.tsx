'use client';

import { cn } from '@/lib/cn';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

export function StatsCard({ title, value, icon, change, changeType = 'neutral', className }: StatsCardProps) {
  return (
    <div className={cn('card flex items-start justify-between', className)}>
      <div>
        <p className="text-sm font-medium text-neutral-300">{title}</p>
        <p className="mt-1 text-2xl font-bold text-secondary-900">{value}</p>
        {change && (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              changeType === 'positive' && 'text-success',
              changeType === 'negative' && 'text-danger',
              changeType === 'neutral' && 'text-neutral-300'
            )}
          >
            {change}
          </p>
        )}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
        {icon}
      </div>
    </div>
  );
}
