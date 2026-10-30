'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
  EyeIcon,
  ClockIcon,
  ArchiveBoxXMarkIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, Pagination, StatsCard, Table } from '@/components/ui';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { useTableState } from '@/hooks/useTableState';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import {
  accountDeletionRequestsService,
  type AccountDeletionRequestItem,
  type AccountDeletionStatus,
} from '@/services/accountDeletionRequests.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const statusVariant: Record<AccountDeletionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  otp_pending: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

function labelize(value: string | null | undefined) {
  return String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Detail row helper ─────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-neutral-100 last:border-0">
      <span className="text-xs font-medium text-neutral-300 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-secondary-800 break-words">{value || '—'}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AccountDeletionRequestsPage() {
  const queryClient = useQueryClient();

  // confirm action state
  const [action, setAction] = useState<{ type: 'approve' | 'reject'; row: AccountDeletionRequestItem } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  // details drawer state
  const [detailRow, setDetailRow] = useState<AccountDeletionRequestItem | null>(null);

  const {
    page,
    pageSize,
    search,
    filters,
    queryParams,
    setPage,
    handleSearch,
    handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['admin-account-deletion-stats'],
    queryFn: () => accountDeletionRequestsService.stats().then((r) => r.data.data),
  });

  // ── List ───────────────────────────────────────────────────────────────────
  const queryKey = useMemo(() => ['admin-account-deletion-requests', queryParams], [queryParams]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      accountDeletionRequestsService
        .list({
          page,
          limit: pageSize,
          search: search || undefined,
          status:    filters.status    || undefined,
          role:      filters.role      || undefined,
          source:    filters.source    || undefined,
          date_from: filters.date_from || undefined,
          date_to:   filters.date_to   || undefined,
        })
        .then((r) => r.data.data),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-account-deletion-requests'] });
    queryClient.invalidateQueries({ queryKey: ['admin-account-deletion-stats'] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      accountDeletionRequestsService.approve(id, note),
    onSuccess: () => {
      toast.success('Account deletion request approved');
      setAction(null);
      setAdminNote('');
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      accountDeletionRequestsService.reject(id, note),
    onSuccess: () => {
      toast.success('Account deletion request rejected');
      setAction(null);
      setAdminNote('');
      invalidate();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to reject'),
  });

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: TableColumn<AccountDeletionRequestItem>[] = [
    {
      key: 'name',
      label: 'Requester',
      render: (_, row) => (
        <div>
          <p className="font-medium text-secondary-900">{row.name || row.user?.name || '—'}</p>
          <p className="text-xs text-neutral-300">{row.email}</p>
          {row.phone && <p className="text-xs text-neutral-300">{row.phone}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (_, row) => (
        <span className="text-sm text-secondary-500">{labelize(row.role || row.user?.role)}</span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (_, row) => <Badge variant="neutral">{labelize(row.source)}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {labelize(row.status)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Requested',
      render: (_, row) => <span className="text-sm text-neutral-300">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'processed_at',
      label: 'Processed',
      render: (_, row) => (
        <div>
          <p className="text-sm text-neutral-300">{row.processed_at ? formatDate(row.processed_at) : '—'}</p>
          {row.processor && (
            <p className="text-xs text-neutral-300">by {row.processor.name || row.processor.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            icon={<EyeIcon className="h-4 w-4" />}
            onClick={() => setDetailRow(row)}
          >
            Details
          </Button>
          {row.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="success"
                icon={<CheckCircleIcon className="h-4 w-4" />}
                onClick={() => setAction({ type: 'approve', row })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<XCircleIcon className="h-4 w-4" />}
                onClick={() => setAction({ type: 'reject', row })}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const pendingAction = approveMutation.isPending || rejectMutation.isPending;
  const actionTitle = action?.type === 'approve' ? 'Approve deletion request' : 'Reject deletion request';

  return (
    <>
      <PageHeader
        title="Account Deletion Requests"
        description="Review account deletion requests submitted via the app or public web form."
      />

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Total Requests"
          value={statsData?.total ?? 0}
          icon={<InboxIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending"
          value={statsData?.pending ?? 0}
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Approved"
          value={statsData?.approved ?? 0}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Rejected"
          value={statsData?.rejected ?? 0}
          icon={<ArchiveBoxXMarkIcon className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-4">
        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, or phone…"
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'OTP Pending', value: 'otp_pending' },
                { label: 'Pending',     value: 'pending' },
                { label: 'Approved',    value: 'approved' },
                { label: 'Rejected',    value: 'rejected' },
              ],
            },
            {
              key: 'role',
              label: 'All Roles',
              value: filters.role || '',
              onChange: (v) => handleFilter('role', v),
              options: [
                { label: 'Customer',         value: 'customer' },
                { label: 'Service Provider', value: 'driver' },
              ],
            },
            {
              key: 'source',
              label: 'All Sources',
              value: filters.source || '',
              onChange: (v) => handleFilter('source', v),
              options: [
                { label: 'App',    value: 'app' },
                { label: 'Web',    value: 'public' },
              ],
            },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-neutral-300 whitespace-nowrap">From</label>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => handleFilter('date_from', e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <label className="text-xs font-medium text-neutral-300 whitespace-nowrap">To</label>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => handleFilter('date_to', e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          }
        />

        <Table
          columns={columns}
          data={data?.requests ?? []}
          isLoading={isLoading}
          emptyMessage="No account deletion requests found"
          rowKey={(row) => row.id}
        />

        <Pagination
          currentPage={data?.pagination.page ?? page}
          totalPages={data?.pagination.total_pages ?? 1}
          totalItems={data?.pagination.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {/* ── View Details Drawer ───────────────────────────────────────────── */}
      <Drawer
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title="Request Details"
      >
        {detailRow && (
          <div className="flex flex-col gap-1 px-6 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-300">Requester</p>
            <DetailRow label="Name"   value={detailRow.name || detailRow.user?.name} />
            <DetailRow label="Email"  value={detailRow.email} />
            <DetailRow label="Phone"  value={detailRow.phone} />
            <DetailRow label="Role"   value={labelize(detailRow.role || detailRow.user?.role)} />
            <DetailRow label="Source" value={labelize(detailRow.source)} />

            <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-300">Request Info</p>
            <DetailRow label="Status"       value={
              <Badge variant={statusVariant[detailRow.status] || 'neutral'} dot>{labelize(detailRow.status)}</Badge>
            } />
            <DetailRow label="Reason"       value={detailRow.reason} />
            <DetailRow label="Requested at" value={formatDate(detailRow.created_at)} />

            {detailRow.processed_at && (
              <>
                <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-300">Processing</p>
                <DetailRow label="Processed at" value={formatDate(detailRow.processed_at)} />
                <DetailRow label="Processed by" value={detailRow.processor?.name || detailRow.processor?.email} />
                <DetailRow label="Admin note"   value={detailRow.admin_note} />
              </>
            )}

            {detailRow.user && (
              <>
                <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-300">Linked Account</p>
                <DetailRow label="Account ID"     value={String(detailRow.user.id)} />
                <DetailRow label="Account status" value={labelize(detailRow.user.status)} />
              </>
            )}

            {detailRow.status === 'pending' && (
              <div className="mt-6 flex gap-3">
                <Button
                  variant="success"
                  className="flex-1"
                  icon={<CheckCircleIcon className="h-4 w-4" />}
                  onClick={() => { setDetailRow(null); setAction({ type: 'approve', row: detailRow }); }}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  icon={<XCircleIcon className="h-4 w-4" />}
                  onClick={() => { setDetailRow(null); setAction({ type: 'reject', row: detailRow }); }}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Confirm action Modal ──────────────────────────────────────────── */}
      <Modal
        open={Boolean(action)}
        onClose={() => { if (pendingAction) return; setAction(null); setAdminNote(''); }}
        title={actionTitle}
        size="md"
      >
        <div className="space-y-4">
          {/* user summary inside confirm dialog */}
          {action?.row && (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
              <p className="font-medium text-secondary-800">{action.row.name || action.row.user?.name || action.row.email}</p>
              <p className="text-xs text-neutral-300">{action.row.email}</p>
              <p className="mt-1 text-xs text-neutral-300">
                {labelize(action.row.role)} &middot; via {labelize(action.row.source)} &middot; {formatDate(action.row.created_at)}
              </p>
              {action.row.reason && (
                <p className="mt-2 border-t border-neutral-200 pt-2 text-xs text-secondary-500 italic">
                  &ldquo;{action.row.reason}&rdquo;
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 rounded-xl bg-warning-50 p-4 text-sm text-secondary-600">
            <ShieldExclamationIcon className="h-5 w-5 flex-shrink-0 text-warning" />
            <p>
              {action?.type === 'approve'
                ? 'Approving will suspend the linked account and sign the user out of active sessions.'
                : 'Please add a reason for rejecting this deletion request.'}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">
              Admin note {action?.type === 'reject' ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="min-h-[100px] w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Add internal note…"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => { setAction(null); setAdminNote(''); }}
              disabled={pendingAction}
            >
              Cancel
            </Button>
            <Button
              variant={action?.type === 'approve' ? 'success' : 'danger'}
              loading={pendingAction}
              onClick={() => {
                if (!action) return;
                if (action.type === 'reject' && !adminNote.trim()) {
                  toast.error('Admin note is required to reject a request');
                  return;
                }
                if (action.type === 'approve') {
                  approveMutation.mutate({ id: action.row.id, note: adminNote });
                } else {
                  rejectMutation.mutate({ id: action.row.id, note: adminNote });
                }
              }}
            >
              {action?.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
