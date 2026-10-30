'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import { StatsCard } from '@/components/ui';
import {
  BoltIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

export function LiveKpiWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports-live-kpis'],
    queryFn: () => reportsService.getLiveKpis().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-20 rounded bg-neutral-100" />
            <div className="mt-3 h-7 w-12 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  const widgets = [
    { title: 'Active Services', value: data?.active_services_now ?? 0, icon: <BoltIcon className="h-5 w-5" /> },
    { title: 'Online Providers', value: data?.online_providers ?? 0, icon: <UserGroupIcon className="h-5 w-5" /> },
    { title: 'Pending Bookings', value: data?.pending_bookings ?? 0, icon: <ClockIcon className="h-5 w-5" /> },
    { title: 'Open Disputes', value: data?.open_disputes ?? 0, icon: <ExclamationTriangleIcon className="h-5 w-5" /> },
    { title: 'Failed Payments', value: data?.failed_payments ?? 0, icon: <CreditCardIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-neutral-300">Live KPIs · refreshes every 30s</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {widgets.map((w) => (
          <StatsCard key={w.title} title={w.title} value={w.value} icon={w.icon} />
        ))}
      </div>
    </div>
  );
}
