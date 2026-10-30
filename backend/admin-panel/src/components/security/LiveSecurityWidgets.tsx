'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { securityService } from '@/services/security.service';
import { StatsCard } from '@/components/ui';
import {
  UsersIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export function LiveSecurityWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ['security-live-widgets'],
    queryFn: () => securityService.getLiveWidgets().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-neutral-50" />
        ))}
      </div>
    );
  }

  const widgets = [
    {
      title: 'Active sessions',
      value: data?.active_admin_sessions ?? 0,
      icon: <UsersIcon className="h-5 w-5" />,
      href: '/security/sessions',
    },
    {
      title: 'Failed logins (24h)',
      value: data?.failed_login_attempts_24h ?? 0,
      icon: <XCircleIcon className="h-5 w-5" />,
      href: '/security/logs',
    },
    {
      title: 'Open alerts',
      value: data?.open_security_alerts ?? 0,
      icon: <ShieldExclamationIcon className="h-5 w-5" />,
      href: '/security/monitoring',
    },
    {
      title: 'Critical alerts',
      value: data?.critical_alerts ?? 0,
      icon: <ExclamationTriangleIcon className="h-5 w-5" />,
      href: '/security/monitoring?severity=critical',
    },
    {
      title: 'Pending compliance',
      value: data?.pending_compliance_requests ?? 0,
      icon: <ClipboardDocumentCheckIcon className="h-5 w-5" />,
      href: '/security/compliance?request_status=pending',
    },
  ];

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-neutral-300">Live security · refreshes every 30s</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {widgets.map((w) => (
          <Link key={w.title} href={w.href} className="block transition-opacity hover:opacity-90">
            <StatsCard title={w.title} value={w.value} icon={w.icon} />
          </Link>
        ))}
      </div>
    </div>
  );
}
