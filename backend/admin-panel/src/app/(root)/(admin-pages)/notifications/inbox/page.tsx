'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Button, ConfirmModal, Drawer } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import {
  CheckCircleIcon,
  TrashIcon,
  EnvelopeOpenIcon,
  BellIcon,
  UserIcon,
  CalendarDaysIcon,
  TagIcon,
  EyeIcon,
  HashtagIcon,
  LinkIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';
import type { Notification, TableColumn } from '@/types';
import {
  isSupportTicketNotificationType,
  supportTicketsChatHref,
  ticketIdFromNotification,
} from '@/utils/supportNotifications';

const TYPE_LABELS: Record<string, string> = {
  SUPPORT_TICKET_CREATED: 'Support ticket created',
  SUPPORT_TICKET_MESSAGE: 'Support message',
  SUPPORT_TICKET_REPLY: 'Support reply',
  SUPPORT_TICKET_RESOLVED: 'Support resolved',
};

const TYPE_VARIANTS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUPPORT_TICKET_CREATED: 'primary',
  SUPPORT_TICKET_MESSAGE: 'warning',
  SUPPORT_TICKET_REPLY: 'warning',
  SUPPORT_TICKET_RESOLVED: 'success',
};

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
] as const;

function formatType(type: string | null) {
  if (!type) return 'General';
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeVariant(type: string | null): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (!type) return 'neutral';
  return TYPE_VARIANTS[type] || 'neutral';
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(dateStr, 'MMM d, yyyy');
}

function DetailRow({ icon: Icon, label, children }: {
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-50">
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-300">{label}</p>
        <div className="mt-0.5 text-sm text-secondary-700">{children}</div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { page, pageSize, search, sortKey, sortDirection, queryParams, setPage, handleSort, handleSearch } =
    useTableState();

  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const allParams = { ...queryParams, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-notifications', allParams],
    queryFn: () => api.get('/admin/notifications', { params: allParams }).then((r) => r.data.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    queryClient.invalidateQueries({ queryKey: ['navbar-notifications'] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/admin/notifications/${id}/read`),
    onSuccess: () => {
      toast.success('Marked as read');
      invalidate();
      if (selectedNotification) setSelectedNotification({ ...selectedNotification, is_read: true });
    },
    onError: () => toast.error('Failed to mark as read'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/admin/notifications/read-all'),
    onSuccess: () => { toast.success('All notifications marked as read'); invalidate(); },
    onError: () => toast.error('Failed to mark all as read'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/notifications/${id}`),
    onSuccess: () => {
      toast.success('Notification deleted');
      setDeleteTarget(null);
      setSelectedNotification(null);
      invalidate();
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  const handleRowClick = (row: Notification) => {
    if (!row.is_read) markReadMutation.mutate(row.id);
    if (isSupportTicketNotificationType(row.notification_type)) {
      const ticketId = ticketIdFromNotification(row);
      if (ticketId) {
        router.push(supportTicketsChatHref(ticketId));
        return;
      }
    }
    setSelectedNotification(row);
  };

  const columns: TableColumn<Notification>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (_, row) => (
        <div className="max-w-[340px]">
          <div className="flex items-center gap-2">
            {!row.is_read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
            <span className={`line-clamp-1 ${row.is_read ? 'text-secondary-600' : 'font-semibold text-secondary-900'}`}>
              {row.title}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-400 pl-4">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'user_id',
      label: 'User',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-400">
            {(row.user?.name?.[0] || '?').toUpperCase()}
          </div>
          <span className="text-sm text-secondary-600">{row.user?.name || row.user?.email || '—'}</span>
        </div>
      ),
    },
    {
      key: 'notification_type',
      label: 'Type',
      render: (_, row) => <Badge variant={typeVariant(row.notification_type)}>{formatType(row.notification_type)}</Badge>,
    },
    {
      key: 'is_read',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={row.is_read ? 'success' : 'warning'} dot>
          {row.is_read ? 'Read' : 'Unread'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="text-sm text-secondary-600">{formatDate(row.createdAt, 'MMM d, yyyy')}</p>
          <p className="text-[11px] text-neutral-300">{formatDate(row.createdAt, 'h:mm a')}</p>
        </div>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedNotification(row); }}
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-neutral-100 hover:text-secondary-600 transition-colors"
            title="View details"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          {!row.is_read && (
            <button
              onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(row.id); }}
              className="rounded-lg p-1.5 text-neutral-300 hover:bg-primary-50 hover:text-primary transition-colors"
              title="Mark as read"
            >
              <EnvelopeOpenIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-danger transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const unreadExists = (data?.rows ?? []).some((n: Notification) => !n.is_read);
  const rows: Notification[] = data?.rows ?? [];
  const totalNotifications: number = data?.count ?? 0;
  const unreadTotal = rows.filter((n) => !n.is_read).length;

  return (
    <>
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <PageHeader
        title="Admin notification inbox"
        description={`Support and other alerts for your admin account · ${totalNotifications} total${unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}`}
        actions={
          unreadExists ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              loading={markAllReadMutation.isPending}
            >
              <CheckCircleIcon className="mr-1.5 h-4 w-4" />
              Mark All as Read
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-neutral-50 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === tab.key
                    ? 'bg-white text-secondary-900 shadow-sm'
                    : 'text-neutral-400 hover:text-secondary-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <SearchFilter
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder="Search notifications..."
          />
        </div>

        <Table
          columns={columns}
          data={rows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage="No notifications found"
          rowKey={(row) => row.id}
        />
        <Pagination
          currentPage={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          totalItems={data?.count}
          pageSize={pageSize}
        />
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
        title="Notification Details"
      >
        {selectedNotification && (
          <div className="space-y-1">
            {/* Status + Type header */}
            <div className="flex items-center gap-2 mb-5">
              <Badge variant={selectedNotification.is_read ? 'success' : 'warning'} dot>
                {selectedNotification.is_read ? 'Read' : 'Unread'}
              </Badge>
              <Badge variant={typeVariant(selectedNotification.notification_type)}>
                {formatType(selectedNotification.notification_type)}
              </Badge>
            </div>

            {/* Title */}
            <div className="rounded-xl bg-neutral-50 p-4 mb-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <BellIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-secondary-900 leading-snug">
                    {selectedNotification.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-300">{timeAgo(selectedNotification.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Message */}
            <DetailRow icon={ChatBubbleLeftIcon} label="Message">
              <p className="whitespace-pre-wrap leading-relaxed text-secondary-600">
                {selectedNotification.message}
              </p>
            </DetailRow>

            <div className="border-t border-neutral-100" />

            {/* User */}
            <DetailRow icon={UserIcon} label="Recipient">
              {selectedNotification.user ? (
                <div>
                  <p className="font-medium">{selectedNotification.user.name}</p>
                  <p className="text-xs text-neutral-400">{selectedNotification.user.email}</p>
                </div>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
            </DetailRow>

            <div className="border-t border-neutral-100" />

            {/* Booking link */}
            {selectedNotification.booking_id && (
              <>
                <DetailRow icon={LinkIcon} label="Related Booking">
                  <Link
                    href={`/bookings/${selectedNotification.booking_id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    View Booking #{selectedNotification.booking_id}
                    <LinkIcon className="h-3.5 w-3.5" />
                  </Link>
                </DetailRow>
                <div className="border-t border-neutral-100" />
              </>
            )}

            {/* Date */}
            <DetailRow icon={CalendarDaysIcon} label="Sent At">
              {formatDate(selectedNotification.createdAt, 'EEEE, MMM d, yyyy · h:mm a')}
            </DetailRow>

            <div className="border-t border-neutral-100" />

            {/* ID */}
            <DetailRow icon={HashtagIcon} label="Notification ID">
              <span className="font-mono text-xs text-neutral-400">#{selectedNotification.id}</span>
            </DetailRow>

            {/* Actions */}
            <div className="mt-6 flex gap-2 pt-4 border-t border-neutral-100">
              {!selectedNotification.is_read && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markReadMutation.mutate(selectedNotification.id)}
                  loading={markReadMutation.isPending}
                  className="flex-1"
                >
                  <EnvelopeOpenIcon className="mr-1.5 h-4 w-4" />
                  Mark as Read
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => { setDeleteTarget(selectedNotification); }}
                className="flex-1"
              >
                <TrashIcon className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Notification"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
