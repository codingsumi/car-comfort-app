'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const links = [
  { href: '/notifications', label: 'Dashboard', exact: true },
  { href: '/notifications/create', label: 'Create' },
  { href: '/notifications/campaigns', label: 'Campaigns' },
  { href: '/notifications/templates', label: 'Templates' },
  { href: '/notifications/analytics', label: 'Analytics' },
  { href: '/notifications/logs', label: 'Logs' },
  { href: '/notifications/inbox', label: 'Inbox' },
];

export function NotificationSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-neutral-50 p-1">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3.5 py-2 text-xs font-medium transition-all',
              isActive
                ? 'bg-white text-secondary-900 shadow-sm'
                : 'text-neutral-400 hover:text-secondary-600'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
