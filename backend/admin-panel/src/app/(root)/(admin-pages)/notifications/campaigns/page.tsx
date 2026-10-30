'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Button, ConfirmModal } from '@/components/ui';
import { useTableState } from '@/hooks/useTableState';
import { notificationManagementService } from '@/services/notificationManagement.service';
import type { TableColumn } from '@/types';
import type { NotificationCampaign as Campaign } from '@/types/notificationManagement';
import { formatDate } from '@/utils/formatDate';
import { PlusIcon, DocumentDuplicateIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';

const statusVariant: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  scheduled: 'warning',
  sending: 'primary',
  sent: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, search, queryParams, setPage, handleSearch } = useTableState();
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelId, setCancelId] = useState<number | null>(null);

  const params = { ...queryParams, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['notification-campaigns', params],
    queryFn: () => notificationManagementService.listCampaigns(params),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => notificationManagementService.cancelCampaign(id),
    onSuccess: () => {
      toast.success('Campaign cancelled');
      setCancelId(null);
      queryClient.invalidateQueries({ queryKey: ['notification-campaigns'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => notificationManagementService.duplicateCampaign(id),
    onSuccess: () => {
      toast.success('Campaign duplicated');
      queryClient.invalidateQueries({ queryKey: ['notification-campaigns'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => notificationManagementService.retryCampaign(id),
    onSuccess: () => toast.success('Retry queued'),
    onError: () => toast.error('Retry failed'),
  });

  const columns: TableColumn<Campaign>[] = [
    { key: 'campaign_name', label: 'Campaign' },
    { key: 'notification_type', label: 'Type' },
    {
      key: 'delivery_stats',
      label: 'Audience',
      render: (_, r) => r.delivery_stats?.audience_size ?? '—',
    },
    {
      key: 'sent',
      label: 'Delivery',
      render: (_, r) => {
        const s = r.delivery_stats;
        if (!s?.audience_size) return '—';
        const delivered = (s.sent || 0) + (s.skipped || 0);
        const rate = Math.round((delivered / s.audience_size) * 100);
        const failed = s.failed || 0;
        return (
          <div>
            <span className={`text-sm font-medium ${failed > 0 ? 'text-warning' : 'text-success'}`}>
              {rate}%
            </span>
            {failed > 0 && <span className="ml-1 text-xs text-danger">{failed} failed</span>}
          </div>
        );
      },
    },
    {
      key: 'opened',
      label: 'Open Rate',
      render: (_, r) => {
        const s = r.delivery_stats;
        if (!s?.sent) return <span className="text-xs text-neutral-300">—</span>;
        const openRate = s.opened ? Math.round((s.opened / s.sent) * 100) : 0;
        return (
          <div>
            <span className="text-sm font-medium text-secondary-900">{openRate}%</span>
            {s.opened ? <span className="ml-1 text-xs text-neutral-400">({s.opened})</span> : null}
          </div>
        );
      },
    },
    {
      key: 'clicked',
      label: 'Click Rate',
      render: (_, r) => {
        const s = r.delivery_stats;
        if (!s?.sent) return <span className="text-xs text-neutral-300">—</span>;
        const clickRate = s.clicked ? Math.round((s.clicked / s.sent) * 100) : 0;
        return (
          <span className="text-sm text-secondary-700">{clickRate}%</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, r) => <Badge variant={statusVariant[r.status] || 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'scheduled_at',
      label: 'Scheduled',
      render: (_, r) => (r.scheduled_at ? formatDate(r.scheduled_at, 'MMM d, h:mm a') : '—'),
    },
    {
      key: 'creator',
      label: 'Created by',
      render: (_, r) => r.creator?.name || '—',
    },
    {
      key: 'id',
      label: '',
      render: (_, r) => (
        <div className="flex justify-end gap-1">
          {['failed', 'sending'].includes(r.status) && (
            <button
              type="button"
              onClick={() => retryMutation.mutate(r.id)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
              title={r.status === 'sending' ? 'Resume delivery' : 'Retry failed'}
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => duplicateMutation.mutate(r.id)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
          </button>
          {['draft', 'scheduled'].includes(r.status) && (
            <button
              type="button"
              onClick={() => setCancelId(r.id)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-danger"
              title="Cancel"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Manage notification campaigns and delivery"
        actions={
          <Link href="/notifications/create">
            <Button size="sm">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New campaign
            </Button>
          </Link>
        }
      />
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-neutral-50 p-1">
          {['', 'draft', 'scheduled', 'sending', 'sent', 'failed'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                statusFilter === s ? 'bg-white shadow-sm text-secondary-900' : 'text-neutral-400'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <SearchFilter searchValue={search} onSearchChange={handleSearch} searchPlaceholder="Search campaigns..." />
      </div>

      <Table columns={columns} data={(data?.rows as Campaign[]) ?? []} isLoading={isLoading} rowKey={(r) => r.id} />
      <Pagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        totalItems={data?.count}
        pageSize={pageSize}
      />

      <ConfirmModal
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
        title="Cancel campaign"
        message="Cancel this scheduled campaign?"
        confirmLabel="Cancel campaign"
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </>
  );
}
