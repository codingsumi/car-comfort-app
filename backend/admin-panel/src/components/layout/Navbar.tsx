'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  BellIcon,
  BellAlertIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Dropdown } from '@/components/ui';
import api from '@/lib/api';
import type { Notification } from '@/types';
import {
  isSupportTicketNotificationType,
  supportTicketsChatHref,
  ticketIdFromNotification,
} from '@/utils/supportNotifications';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const { data: notificationsData } = useQuery({
    queryKey: ['navbar-notifications'],
    queryFn: () =>
      api.get('/admin/notifications', { params: { limit: 5, sort: 'createdAt', order: 'desc' } }).then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const notifications: Notification[] = notificationsData?.rows ?? [];
  const totalCount: number = notificationsData?.count ?? 0;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white px-4 shadow-sm backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Popover className="relative">
          <PopoverButton className="relative rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-secondary-600 focus:outline-none transition-colors">
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </PopoverButton>

          <Transition
            as={Fragment}
            enter="transition duration-200 ease-out"
            enterFrom="opacity-0 scale-95 translate-y-1"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="transition duration-150 ease-in"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-1"
          >
            <PopoverPanel className="absolute right-0 z-20 mt-2.5 w-96 origin-top-right rounded-2xl border border-neutral-100 bg-white shadow-xl ring-1 ring-black/5 focus:outline-none">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <h3 className="text-sm font-semibold text-secondary-900">Notifications</h3>
                  {totalCount > 0 && (
                    <p className="text-[11px] text-neutral-300 mt-0.5">{totalCount} total{unreadCount > 0 ? `, ${unreadCount} unread` : ''}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-neutral-100" />

              <div className="max-h-[360px] overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50">
                      <BellAlertIcon className="h-6 w-6 text-neutral-200" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-neutral-400">No notifications yet</p>
                    <p className="mt-1 text-xs text-neutral-300">No admin alerts right now</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {notifications.map((n) => {
                      const supportTicketId = isSupportTicketNotificationType(n.notification_type)
                        ? ticketIdFromNotification(n)
                        : null;
                      const supportHref = supportTicketId
                        ? supportTicketsChatHref(supportTicketId)
                        : null;

                      const inner = (
                        <>
                        <div className="relative mt-0.5 flex-shrink-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50">
                            <BellIcon className="h-4 w-4 text-primary" />
                          </div>
                          {!n.is_read && (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug line-clamp-1 ${n.is_read ? 'text-secondary-600' : 'font-semibold text-secondary-900'}`}>
                              {n.title}
                            </p>
                            <span className="flex-shrink-0 text-[11px] text-neutral-300 whitespace-nowrap mt-px">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400 line-clamp-2">{n.message}</p>
                          {isSupportTicketNotificationType(n.notification_type) && n.user?.name && (
                            <p className="mt-1 text-[11px] text-neutral-300">To: {n.user.name}</p>
                          )}
                        </div>
                        </>
                      );

                      if (supportHref) {
                        return (
                          <Link
                            key={n.id}
                            href={supportHref}
                            className="group flex gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80"
                            onClick={() => {
                              void api.patch(`/admin/notifications/${n.id}/read`).catch(() => {});
                            }}
                          >
                            {inner}
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={n.id}
                          className="group flex gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80 cursor-default"
                        >
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <>
                  <div className="border-t border-neutral-100" />
                  <div className="p-2">
                    <Link
                      href="/notifications/inbox"
                      className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-primary hover:bg-primary-50 transition-colors"
                    >
                      View All Notifications
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </>
              )}
            </PopoverPanel>
          </Transition>
        </Popover>

        <Dropdown
          trigger={
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-secondary-500 hover:bg-neutral-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary">
                <span className="text-xs font-bold">
                  {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <span className="hidden md:block">{user?.name || user?.email || 'Admin'}</span>
            </button>
          }
          items={[
            {
              label: 'Profile',
              onClick: () => router.push('/profile'),
              icon: <UserCircleIcon className="h-4 w-4" />,
            },
            {
              label: 'Logout',
              onClick: logout,
              icon: <ArrowRightOnRectangleIcon className="h-4 w-4" />,
              danger: true,
            },
          ]}
        />
      </div>
    </header>
  );
}
