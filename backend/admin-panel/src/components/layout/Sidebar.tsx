'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { AdminLogo } from '@/components/theme/AdminLogo';
import { useAdminThemeStore } from '@/store/adminTheme';
import {
  HomeIcon,
  UsersIcon,
  TruckIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  WrenchIcon,
  BanknotesIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  TagIcon,
  PresentationChartLineIcon,
  ChatBubbleLeftRightIcon,
  ShieldExclamationIcon,
  TicketIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  PlusIcon,
  PaperAirplaneIcon,
  TrashIcon,
  EnvelopeIcon,
  PaintBrushIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  ArrowPathIcon,
  ReceiptPercentIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { SETTINGS_NAV } from '@/lib/settingsNav';

interface NavChild {
  name: string;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
}

interface NavItem {
  name: string;
  href?: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  children?: NavChild[];
}

const SETTINGS_NAV_ICONS: Record<string, NavChild['icon']> = {
  'Legal Pages': DocumentTextIcon,
  General: Cog6ToothIcon,
  Branding: PaintBrushIcon,
  'Admin Branding': PaintBrushIcon,
  Payments: CreditCardIcon,
  Email: EnvelopeIcon,
  Notifications: BellIcon,
  'Social Links': LinkIcon,
  Maintenance: ExclamationTriangleIcon,
  'Company & Invoice': DocumentTextIcon,
  'Audit Logs': ClipboardDocumentListIcon,
  'Tutorial Content': AcademicCapIcon,
  'Customer Tutorials': AcademicCapIcon,
  'Service Provider Tutorial': AcademicCapIcon,
  'Provider Learning Tutorials': AcademicCapIcon,
};

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Analytics',
    icon: PresentationChartLineIcon,
    children: [
      { name: 'Overview', href: '/reports', icon: ChartBarIcon },
      { name: 'Bookings', href: '/reports/bookings', icon: CalendarDaysIcon },
      { name: 'Revenue', href: '/reports/revenue', icon: CurrencyDollarIcon },
      { name: 'Customers', href: '/reports/customers', icon: UserGroupIcon },
      { name: 'Providers', href: '/reports/providers', icon: TruckIcon },
      { name: 'Satisfaction', href: '/reports/satisfaction', icon: StarIcon },
      { name: 'Service Duration', href: '/reports/service-duration', icon: ClockIcon },
      { name: 'Export Center', href: '/reports/export', icon: DocumentTextIcon },
    ],
  },
  {
    name: 'Users',
    icon: UsersIcon,
    children: [
      { name: 'Admins', href: '/users/admins', icon: ShieldCheckIcon },
      { name: 'Customers', href: '/customers', icon: UserGroupIcon },
      { name: 'Providers', href: '/providers', icon: WrenchIcon },
    ],
  },
  { name: 'Account deletion', href: '/account-deletion', icon: TrashIcon },
  {
    name: 'Bookings',
    icon: CalendarDaysIcon,
    children: [
      { name: 'All bookings', href: '/bookings', icon: CalendarDaysIcon },
      { name: 'Live Map', href: '/bookings/fleet-map', icon: MapPinIcon },
      { name: 'Disputes', href: '/disputes', icon: ExclamationTriangleIcon },
    ],
  },
  {
    name: 'Notifications',
    icon: BellIcon,
    children: [
      { name: 'Dashboard', href: '/notifications', icon: ChartBarIcon },
      { name: 'Create', href: '/notifications/create', icon: PlusIcon },
      { name: 'Campaigns', href: '/notifications/campaigns', icon: PaperAirplaneIcon },
      { name: 'Templates', href: '/notifications/templates', icon: DocumentTextIcon },
      { name: 'Analytics', href: '/notifications/analytics', icon: PresentationChartLineIcon },
      { name: 'Logs', href: '/notifications/logs', icon: ClipboardDocumentListIcon },
      { name: 'Inbox', href: '/notifications/inbox', icon: BellIcon },
    ],
  },
  {
    name: 'Vehicles',
    icon: TruckIcon,
    children: [
      { name: 'All vehicles', href: '/vehicles', icon: TruckIcon },
      { name: 'Vehicle types', href: '/vehicles/types', icon: TagIcon },
    ],
  },
  {
    name: 'Support',
    icon: TicketIcon,
    children: [
      { name: 'Dashboard', href: '/support', icon: HomeIcon },
      { name: 'Tickets', href: '/support/tickets', icon: TicketIcon },
      { name: 'Email History', href: '/support/email-history', icon: EnvelopeIcon },
      { name: 'Reported Issues', href: '/support/reported-issues', icon: ShieldExclamationIcon },
      { name: 'Issue Analytics', href: '/support/issues', icon: ChartBarIcon },
      { name: 'FAQs', href: '/support/faq', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    name: 'Security',
    icon: ShieldCheckIcon,
    children: [
      { name: 'Dashboard', href: '/security', icon: HomeIcon },
      { name: 'Overview', href: '/security/overview', icon: ShieldCheckIcon },
      { name: 'Activity logs', href: '/security/logs', icon: ClipboardDocumentListIcon },
      { name: 'Compliance', href: '/security/compliance', icon: DocumentTextIcon },
      { name: 'Monitoring', href: '/security/monitoring', icon: ShieldExclamationIcon },
      { name: 'Sessions', href: '/security/sessions', icon: UsersIcon },
    ],
  },
  {
    name: 'Trust & Safety',
    icon: ShieldExclamationIcon,
    children: [
      { name: 'Moderation hub', href: '/content-moderation', icon: HomeIcon },
      { name: 'Reviews', href: '/content-moderation/reviews', icon: ChatBubbleLeftRightIcon },
      { name: 'Reports', href: '/content-moderation/reports', icon: ShieldExclamationIcon },
      { name: 'Audit logs', href: '/content-moderation/logs', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    name: 'Performance',
    icon: PresentationChartLineIcon,
    children: [
      { name: 'Provider Performance', href: '/provider-performance', icon: ChartBarIcon },
    ],
  },
  { name: 'Services', href: '/services', icon: WrenchScrewdriverIcon },
  {
    name: 'Taxes & Charges',
    icon: ReceiptPercentIcon,
    children: [
      { name: 'Fees & Taxes', href: '/finance/pricing', icon: TagIcon },
      { name: 'Booking Charges', href: '/bookings/charges', icon: CreditCardIcon },
      { name: 'Payment Settings', href: '/settings/payments', icon: CurrencyDollarIcon },
      { name: 'Promotions & Sales', href: '/promotions', icon: MegaphoneIcon },
    ],
  },
  {
    name: 'Finance',
    icon: BanknotesIcon,
    children: [
      { name: 'Transactions', href: '/finance/transactions', icon: CreditCardIcon },
      { name: 'Payouts', href: '/finance/payouts', icon: CurrencyDollarIcon },
      { name: 'Refund History', href: '/finance/refunds', icon: ArrowPathIcon },
      { name: 'Reports', href: '/finance/reports', icon: ChartBarIcon },
    ],
  },
  {
    name: 'Settings',
    icon: Cog6ToothIcon,
    children: SETTINGS_NAV.map((item) => ({
      name: item.label,
      href: item.href,
      icon: SETTINGS_NAV_ICONS[item.label] ?? Cog6ToothIcon,
    })),
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function NavItemLink({ item, pathname }: { item: { name: string; href: string; icon: NavChild['icon'] }; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary-50 text-primary'
          : 'text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500'
      )}
    >
      <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-primary' : 'text-neutral-200')} />
      {item.name}
    </Link>
  );
}

function isSettingsPath(pathname: string) {
  if (pathname.startsWith('/settings/payments')) return false; // moved to Taxes & Charges
  return pathname === '/settings' || pathname.startsWith('/settings/') || pathname.startsWith('/legal-pages');
}

function isNavChildActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CollapsibleNav({ item, pathname }: { item: NavItem & { children: NavChild[] }; pathname: string }) {
  const isChildActive =
    item.name === 'Settings'
      ? isSettingsPath(pathname)
      : item.children.some((child) => isNavChildActive(pathname, child.href));
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isChildActive
            ? 'text-primary'
            : 'text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className={cn('h-5 w-5 flex-shrink-0', isChildActive ? 'text-primary' : 'text-neutral-200')} />
          {item.name}
        </div>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            open ? 'rotate-180' : '',
            isChildActive ? 'text-primary' : 'text-neutral-200'
          )}
        />
      </button>
      {open && (
        <ul className="mt-1 ml-4 space-y-0.5 border-l border-neutral-100 pl-3">
          {item.children.map((child) => {
            const isActive = isNavChildActive(pathname, child.href);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary'
                      : 'text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500'
                  )}
                >
                  <child.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-neutral-200')} />
                  {child.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const branding = useAdminThemeStore((s) => s.branding);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center gap-3 bg-white px-6 shadow-sm">
        <AdminLogo size="sm" subtitle="Admin Panel" />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {item.children ? (
                <CollapsibleNav item={item as NavItem & { children: NavChild[] }} pathname={pathname} />
              ) : (
                <NavItemLink item={item as NavChild} pathname={pathname} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-neutral-100 px-4 py-3">
        <p className="text-[10px] text-neutral-200">v1.0.0 &middot; {branding.name} Admin</p>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)]">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 flex h-full w-64 min-h-0 flex-col overflow-hidden bg-white shadow-xl">
            <button
              onClick={onClose}
              className="absolute right-3 top-4 z-10 rounded-lg p-1 text-neutral-300 hover:bg-neutral-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
