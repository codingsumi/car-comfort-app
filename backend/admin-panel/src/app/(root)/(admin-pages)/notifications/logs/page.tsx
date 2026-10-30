'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Select } from '@/components/ui';
import { useTableState } from '@/hooks/useTableState';
import { notificationManagementService } from '@/services/notificationManagement.service';
import type { TableColumn } from '@/types';
import type { NotificationDeliveryLog } from '@/types/notificationManagement';
import { formatDate } from '@/utils/formatDate';

const statusVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  delivered: 'success',
  opened: 'primary',
  clicked: 'primary',
  failed: 'danger',
  pending: 'warning',
  skipped: 'neutral',
};

export default function NotificationLogsPage() {
  const { page, pageSize, search, queryParams, setPage, handleSearch } = useTableState();
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  const params = {
    ...queryParams,
    ...(channel ? { channel } : {}),
    ...(status ? { delivery_status: status } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notification-logs', params],
    queryFn: () => notificationManagementService.listLogs(params),
  });

  const columns: TableColumn<NotificationDeliveryLog>[] = [
    { key: 'id', label: 'ID' },
    {
      key: 'recipient',
      label: 'Recipient',
      render: (_, r) => (
        <div>
          <p className="text-sm font-medium">{r.recipient?.name || '—'}</p>
          <p className="text-xs text-neutral-400">{r.recipient?.email}</p>
        </div>
      ),
    },
    { key: 'channel', label: 'Channel', render: (_, r) => <Badge variant="neutral">{r.channel}</Badge> },
    {
      key: 'delivery_status',
      label: 'Status',
      render: (_, r) => (
        <Badge variant={statusVariant[r.delivery_status] || 'neutral'}>{r.delivery_status}</Badge>
      ),
    },
    {
      key: 'delivered_at',
      label: 'Delivered',
      render: (_, r) => (r.delivered_at ? formatDate(r.delivered_at, 'MMM d, h:mm a') : '—'),
    },
    {
      key: 'opened_at',
      label: 'Opened',
      render: (_, r) => (r.opened_at ? formatDate(r.opened_at, 'MMM d, h:mm a') : '—'),
    },
    {
      key: 'campaign',
      label: 'Campaign',
      render: (_, r) => r.campaign?.campaign_name || '—',
    },
    {
      key: 'failure_reason',
      label: 'Failure',
      render: (_, r) => (
        <span className="line-clamp-1 text-xs text-danger">{r.failure_reason || '—'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Delivery logs" description="Full notification delivery history" />
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(1); }}
          className="w-36"
          options={[
            { value: '', label: 'All channels' },
            { value: 'push', label: 'Push' },
            { value: 'email', label: 'Email' },
            { value: 'in_app', label: 'In-app' },
          ]}
        />
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-36"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'failed', label: 'Failed' },
            { value: 'opened', label: 'Opened' },
            { value: 'skipped', label: 'Skipped' },
          ]}
        />
        <SearchFilter searchValue={search} onSearchChange={handleSearch} searchPlaceholder="Search recipient..." />
      </div>

      <Table columns={columns} data={data?.rows ?? []} isLoading={isLoading} rowKey={(r) => r.id} />
      <Pagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        totalItems={data?.count}
        pageSize={pageSize}
      />
    </>
  );
}
