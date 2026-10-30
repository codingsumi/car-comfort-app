'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { driversService } from '@/services/drivers.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SafeImage } from '@/components/shared/SafeImage';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Button, Modal } from '@/components/ui';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatJoinedDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';
import type { DriverProfile, TableColumn } from '@/types';

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U1RTdFQiIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOUNBM0FGIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEwIiByeD0iMzYiIHJ5PSIyOCIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';

const statusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

export default function DriversPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState<{ open: boolean; userId: number | null }>({
    open: false,
    userId: null,
  });
  const [rejectReason, setRejectReason] = useState('');

  const {
    page, pageSize, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState();

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', queryParams],
    queryFn: () => driversService.list({ ...queryParams, approval_status: filters.approval_status }).then((r) => r.data.data),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => driversService.approve(userId),
    onSuccess: () => {
      toast.success('Service provider approved');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) =>
      driversService.reject(userId, reason),
    onSuccess: () => {
      toast.success('Service provider rejected');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setRejectModal({ open: false, userId: null });
      setRejectReason('');
    },
  });

  const columns: TableColumn<DriverProfile>[] = [
    {
      key: 'user',
      label: 'Service Provider',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <SafeImage
            src={row.profile_picture || DEFAULT_AVATAR}
            alt=""
            fallbackSrc={DEFAULT_AVATAR}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-secondary-900">{row.user?.name || row.user?.email || '—'}</p>
            <p className="text-xs text-neutral-300">{row.user?.email || ''}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (_, row) => row.user?.phone || '—' },
    {
      key: 'approval_status',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <Badge variant={statusVariant[row.approval_status] || 'neutral'} dot>
          {row.approval_status.charAt(0).toUpperCase() + row.approval_status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'is_completed',
      label: 'Profile',
      render: (_, row) => (
        <Badge variant={row.is_completed ? 'success' : 'warning'}>
          {row.is_completed ? 'Complete' : `Step ${row.current_step}`}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Applied',
      sortable: true,
      render: (_, row) => formatJoinedDate(row),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        if (row.approval_status !== 'pending') return null;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="success"
              onClick={() => approveMutation.mutate(row.user_id)}
              loading={approveMutation.isPending}
              icon={<CheckIcon className="h-3.5 w-3.5" />}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setRejectModal({ open: true, userId: row.user_id })}
              icon={<XMarkIcon className="h-3.5 w-3.5" />}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Service Providers" description="Manage service provider applications and profiles" />
      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email..."
          filters={[
            {
              key: 'approval_status',
              label: 'All Statuses',
              value: filters.approval_status || '',
              onChange: (v) => handleFilter('approval_status', v),
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ],
            },
          ]}
        />
        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => router.push(`/users/drivers/${row.user_id}`)}
          isLoading={isLoading}
          emptyMessage="No service providers found"
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

      <Modal
        open={rejectModal.open}
        onClose={() => { setRejectModal({ open: false, userId: null }); setRejectReason(''); }}
        title="Reject Service Provider"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-500">
            Provide a reason for rejection. The service provider will be notified via email and SMS and can resubmit their data.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-900">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g., Driver's license photo is blurry..."
              className="input w-full resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal({ open: false, userId: null }); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectModal.userId && rejectMutation.mutate({ userId: rejectModal.userId, reason: rejectReason })}
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
            >
              Reject & Notify Service Provider
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
