'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const links = [
  { href: '/support', label: 'Dashboard' },
  { href: '/support/tickets', label: 'Tickets' },
  { href: '/support/email-history', label: 'Email History' },
  { href: '/support/reported-issues', label: 'Reported Issues' },
  { href: '/support/issues', label: 'Analytics' },
  { href: '/support/faq', label: 'FAQs' },
];

export function SupportNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-neutral-100 pb-1">
      {links.map((link) => {
        const isActive =
          link.href === '/support'
            ? pathname === '/support'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'text-neutral-300 hover:text-secondary-700'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
