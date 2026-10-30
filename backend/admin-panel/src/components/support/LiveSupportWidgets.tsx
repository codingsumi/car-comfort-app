'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { supportService } from '@/services/support.service';
import { StatsCard } from '@/components/ui';
import {
  InboxArrowDownIcon,
  ChatBubbleLeftEllipsisIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export function LiveSupportWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ['support-live-widgets'],
    queryFn: () => supportService.getLiveWidgets().then((r) => r.data.data),
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
      title: 'New tickets (24h)',
      value: data?.new_incoming_tickets ?? 0,
      icon: <InboxArrowDownIcon className="h-5 w-5" />,
      href: '/support/tickets',
    },
    {
      title: 'Pending responses',
      value: data?.pending_responses ?? 0,
      icon: <ClockIcon className="h-5 w-5" />,
      href: '/support/tickets?status=pending',
    },
    {
      title: 'Unread / active',
      value: data?.unread_messages ?? 0,
      icon: <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />,
      href: '/support/tickets',
    },
    {
      title: 'High priority',
      value: data?.high_priority_cases ?? 0,
      icon: <ExclamationTriangleIcon className="h-5 w-5" />,
      href: '/support/tickets?priority=high',
    },
    {
      title: 'Escalated',
      value: data?.escalated_disputes ?? 0,
      icon: <ArrowTrendingUpIcon className="h-5 w-5" />,
      href: '/support/tickets?status=escalated',
    },
  ];

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-neutral-300">Live support · refreshes every 30s</p>
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
