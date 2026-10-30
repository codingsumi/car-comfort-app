'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { SimpleRichEditor } from '@/components/shared/SimpleRichEditor';
import { StatsCard, Badge, Button, Pagination, Modal, ConfirmModal, Table, Dropdown } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import { providerPerformanceService } from '@/services/providerPerformance.service';
import type { ModerationReviewDetailResponse } from '@/types/contentModeration';
import type { ModerationReview } from '@/types/providerPerformance';
import toast from 'react-hot-toast';
import {
  StarIcon,
  CheckCircleIcon,
  EyeSlashIcon,
  TrashIcon,
  FlagIcon,
  PencilIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftIcon,
  ClockIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';

/* ── helpers ──────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  hidden: 'neutral',
  removed: 'danger',
  flagged: 'primary',
};

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={`h-3.5 w-3.5 flex-shrink-0 ${i < rating ? 'fill-warning text-warning' : 'text-neutral-200'}`}
        />
      ))}
    </div>
  );
}

const REPORT_FILTER_OPTS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Flagged only', value: 'flagged' },
  { label: 'Offensive / auto-flagged', value: 'offensive' },
];

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function ContentModerationReviewsPage() {
  const qc = useQueryClient();
  const { page, search, sortKey, sortDirection, filters, queryParams, setPage, handleSort, handleSearch, handleFilter } =
    useTableState({ defaultSortKey: 'created_at', defaultSortDirection: 'desc' });

  const [detail, setDetail] = useState<ModerationReviewDetailResponse | null>(null);
  const [modalAction, setModalAction] = useState('');
  const [selected, setSelected] = useState<ModerationReview | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [edited, setEdited] = useState('');
  const [respondReview, setRespondReview] = useState<ModerationReview | null>(null);
  const [responseText, setResponseText] = useState('');
  const [deleteResponseTarget, setDeleteResponseTarget] = useState<ModerationReview | null>(null);

  const listParams: Record<string, string | number | undefined> = {
    ...queryParams,
    moderation_status: filters.moderation_status || undefined,
    flagged_only: filters.queue === 'flagged' ? 'true' : undefined,
    pending_only: filters.queue === 'pending' ? 'true' : undefined,
    offensive_only: filters.queue === 'offensive' ? 'true' : undefined,
    user_type: filters.user_type || undefined,
    booking_code: filters.booking_code || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    min_rating: filters.min_rating || undefined,
    max_rating: filters.max_rating || undefined,
  };

  const { data: reviewStats } = useQuery({
    queryKey: ['moderation-review-stats-v2'],
    queryFn: () => providerPerformanceService.getReviewStats().then((r) => r.data.data),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['moderation-reviews', listParams],
    queryFn: () => contentModerationService.listReviews(listParams).then((r) => r.data.data),
  });

  const statusMut = useMutation({
    mutationFn: (payload: { id: number; status: string; reason?: string; moderation_notes?: string }) =>
      contentModerationService.updateReviewStatus(payload.id, payload),
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['moderation-reviews'] });
      qc.invalidateQueries({ queryKey: ['moderation-review-stats-v2'] });
      closeModal();
    },
    onError: () => toast.error('Update failed'),
  });

  const editMut = useMutation({
    mutationFn: (payload: { id: number; message: string }) =>
      contentModerationService.editReview(payload.id, payload.message),
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['moderation-reviews'] });
      closeModal();
    },
    onError: () => toast.error('Save failed'),
  });

  const respondMut = useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      contentModerationService.respondToReview(id, response),
    onSuccess: () => {
      toast.success('Response posted');
      qc.invalidateQueries({ queryKey: ['moderation-reviews'] });
      setRespondReview(null);
      setResponseText('');
    },
    onError: () => toast.error('Failed to post response'),
  });

  const deleteResponseMut = useMutation({
    mutationFn: (id: number) => contentModerationService.deleteReviewResponse(id),
    onSuccess: () => {
      toast.success('Response deleted');
      qc.invalidateQueries({ queryKey: ['moderation-reviews'] });
      setDeleteResponseTarget(null);
    },
    onError: () => toast.error('Failed to delete response'),
  });

  function closeModal() {
    setModalAction('');
    setSelected(null);
    setReason('');
    setNotes('');
  }

  async function openDetail(r: ModerationReview) {
    const res = await contentModerationService.getReview(r.id);
    setDetail(res.data.data as ModerationReviewDetailResponse);
  }

  function openAction(r: ModerationReview, action: string) {
    setSelected(r);
    setModalAction(action);
    setReason('');
    setNotes(r.moderation_notes || '');
    setEdited(r.message || '');
  }

  function openRespond(r: ModerationReview) {
    setRespondReview(r);
    setResponseText(r.admin_response || '');
  }

  function submitModal() {
    if (!selected) return;
    if (modalAction === 'edit') {
      editMut.mutate({ id: selected.id, message: edited });
      return;
    }
    statusMut.mutate({ id: selected.id, status: modalAction, reason: reason || undefined, moderation_notes: notes || undefined });
  }

  /* ── table columns ──────────────────────────────────────────────────────── */

  const columns: TableColumn<ModerationReview>[] = [
    {
      key: 'reviewer',
      label: 'Customer',
      sortable: true,
      render: (_, r) => (
        <span className="text-sm font-medium text-secondary-800">{r.reviewer?.name || '—'}</span>
      ),
    },
    {
      key: 'reviewee',
      label: 'Provider',
      sortable: true,
      render: (_, r) => (
        <span className="text-sm text-secondary-700">{r.reviewee?.name || '—'}</span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (_, r) => <StarRating rating={r.rating} />,
    },
    {
      key: 'message',
      label: 'Review',
      render: (_, r) => (
        <div className="max-w-xs space-y-1">
          <p className="line-clamp-2 text-sm text-secondary-800">{r.message || <span className="italic text-neutral-400">No message</span>}</p>
          {r.admin_response && (
            <div className="flex items-start gap-1">
              <ChatBubbleOvalLeftIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary-400" />
              <p className="line-clamp-1 text-xs text-primary-600">{r.admin_response}</p>
            </div>
          )}
          {(r.flags_count ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <FlagIcon className="h-3 w-3 text-danger" />
              <span className="text-xs font-medium text-danger">{r.flags_count} flag{(r.flags_count ?? 0) > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      render: (_, r) => (
        <span className="font-mono text-xs text-neutral-400">{r.booking?.booking_code ?? '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (_, r) => (
        <span className="whitespace-nowrap text-xs text-neutral-400">
          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'moderation_status',
      label: 'Status',
      sortable: true,
      render: (_, r) => (
        <Badge variant={STATUS_COLORS[r.moderation_status] || 'neutral'} dot>
          {statusLabel(r.moderation_status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, r) => (
        <div className="flex items-center justify-end">
          <Dropdown
            align="right"
            trigger={
              <button
                className="rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                title="Actions"
              >
                <EllipsisVerticalIcon className="h-4 w-4" />
              </button>
            }
            items={[
              {
                label: 'View details',
                icon: <ChatBubbleLeftRightIcon className="h-4 w-4" />,
                onClick: () => openDetail(r),
              },
              ...(r.moderation_status !== 'approved' ? [{
                label: 'Approve',
                icon: <CheckCircleIcon className="h-4 w-4" />,
                onClick: () => openAction(r, 'approved'),
              }] : []),
              ...(r.moderation_status !== 'hidden' ? [{
                label: 'Hide from public',
                icon: <EyeSlashIcon className="h-4 w-4" />,
                onClick: () => openAction(r, 'hidden'),
              }] : []),
              ...(r.moderation_status !== 'flagged' ? [{
                label: 'Flag for review',
                icon: <FlagIcon className="h-4 w-4" />,
                onClick: () => openAction(r, 'flagged'),
              }] : []),
              {
                label: 'Edit content',
                icon: <PencilIcon className="h-4 w-4" />,
                onClick: () => openAction(r, 'edit'),
              },
              {
                label: r.admin_response ? 'Edit response' : 'Respond to review',
                icon: <ChatBubbleOvalLeftIcon className="h-4 w-4" />,
                onClick: () => openRespond(r),
              },
              ...(r.admin_response ? [{
                label: 'Delete response',
                icon: <TrashIcon className="h-4 w-4" />,
                onClick: () => setDeleteResponseTarget(r),
                danger: true,
              }] : []),
              ...(r.moderation_status !== 'removed' ? [{
                label: 'Remove review',
                icon: <TrashIcon className="h-4 w-4" />,
                onClick: () => openAction(r, 'removed'),
                danger: true,
              }] : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Review moderation"
        description="Approve, hide, flag, remove, respond to, or edit reviews with full audit history."
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard title="Pending" value={reviewStats?.pending ?? 0} icon={<ClockIcon className="h-5 w-5" />} changeType={reviewStats?.pending ? 'negative' : 'neutral'} />
        <StatsCard title="Flagged" value={reviewStats?.flagged ?? 0} icon={<FlagIcon className="h-5 w-5" />} changeType={reviewStats?.flagged ? 'negative' : 'neutral'} />
        <StatsCard title="Approved" value={reviewStats?.approved ?? 0} icon={<CheckCircleIcon className="h-5 w-5" />} />
        <StatsCard title="Hidden" value={reviewStats?.hidden ?? 0} icon={<EyeSlashIcon className="h-5 w-5" />} />
        <StatsCard title="Removed" value={reviewStats?.removed ?? 0} icon={<TrashIcon className="h-5 w-5" />} />
        <StatsCard
          title="Avg rating"
          value={`★ ${reviewStats?.avg_rating?.toFixed(1) ?? '—'}`}
          icon={<StarIcon className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">

        {/* Row 1: search + primary filters (queue, status) */}
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search customer, provider, review text, booking code…"
          filters={[
            {
              key: 'queue',
              label: 'Queue',
              value: filters.queue || '',
              onChange: (v) => handleFilter('queue', v),
              options: [{ label: 'All', value: '' }, ...REPORT_FILTER_OPTS],
            },
            {
              key: 'moderation_status',
              label: 'Status',
              value: filters.moderation_status || '',
              onChange: (v) => handleFilter('moderation_status', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Hidden', value: 'hidden' },
                { label: 'Removed', value: 'removed' },
                { label: 'Flagged', value: 'flagged' },
              ],
            },
          ]}
        />

        {/* Row 2: secondary filters + date range — all wrap on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-secondary-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={filters.user_type || ''}
            onChange={(e) => handleFilter('user_type', e.target.value)}
          >
            <option value="">Reviewer</option>
            <option value="customer">Customer reviews</option>
            <option value="driver">Provider reviews</option>
          </select>

          <select
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-secondary-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={filters.min_rating || ''}
            onChange={(e) => handleFilter('min_rating', e.target.value)}
          >
            <option value="">Min stars</option>
            <option value="1">★ 1+</option>
            <option value="2">★★ 2+</option>
            <option value="3">★★★ 3+</option>
            <option value="4">★★★★ 4+</option>
            <option value="5">★★★★★ 5 only</option>
          </select>

          <span className="h-5 w-px bg-neutral-200" />

          <input
            type="date"
            title="From date"
            className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-secondary-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={filters.date_from || ''}
            onChange={(e) => handleFilter('date_from', e.target.value)}
          />
          <span className="text-xs text-neutral-400">&ndash;</span>
          <input
            type="date"
            title="To date"
            className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-secondary-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={filters.date_to || ''}
            onChange={(e) => handleFilter('date_to', e.target.value)}
          />

          {(filters.user_type || filters.min_rating || filters.date_from || filters.date_to) && (
            <button
              onClick={() => {
                handleFilter('user_type', '');
                handleFilter('min_rating', '');
                handleFilter('date_from', '');
                handleFilter('date_to', '');
              }}
              className="text-xs text-neutral-400 hover:text-danger transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

      </div>

      {/* Table */}
      <div className="card p-0">
        <Table
          columns={columns}
          data={listData?.reviews || []}
          isLoading={isLoading}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          rowKey={(r) => r.id}
          emptyMessage="No reviews found"
        />
        <div className="border-t border-neutral-50 p-3">
          <Pagination
            currentPage={page}
            totalPages={listData?.pagination.total_pages ?? 1}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* ── Review detail modal ───────────────────────────────────────────── */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Review details" size="lg">
        {detail && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {/* Stars + parties */}
            <div className="flex items-center gap-3">
              <StarRating rating={detail.review.rating} />
              <span className="text-sm text-neutral-500">
                <span className="font-medium text-secondary-800">{detail.review.reviewer?.name}</span>
                {' → '}
                <span className="font-medium text-secondary-800">{detail.review.reviewee?.name}</span>
              </span>
            </div>

            {/* Review message */}
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-400">Review</p>
              <p className="text-sm text-secondary-800 whitespace-pre-wrap leading-relaxed">
                {detail.review.message || <span className="italic text-neutral-400">No message</span>}
              </p>
            </div>

            {/* Admin response */}
            {detail.review.admin_response && (
              <div className="border-l-2 border-primary-300 pl-3">
                <p className="mb-0.5 text-xs font-semibold text-primary-600">Admin response</p>
                <p className="text-sm text-secondary-800 whitespace-pre-wrap">{detail.review.admin_response}</p>
                {detail.review.admin_responded_at && (
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(detail.review.admin_responded_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Auto-flag reasons */}
            {detail.review.auto_flag_reasons != null && (
              <div className="rounded-lg border border-warning-200 bg-warning-50/60 p-3">
                <p className="mb-1 text-xs font-semibold text-warning-700">Auto-flag signals</p>
                <pre className="overflow-x-auto text-xs text-neutral-600">
                  {JSON.stringify(detail.review.auto_flag_reasons, null, 2)}
                </pre>
              </div>
            )}

            {/* Moderation history */}
            {detail.moderation_history.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-400">Moderation history</p>
                <ul className="space-y-1.5 border-l-2 border-neutral-100 pl-3">
                  {detail.moderation_history.map((h) => (
                    <li key={h.id} className="text-xs text-neutral-600">
                      <span className="font-medium text-secondary-700">{h.action_type.replace(/_/g, ' ')}</span>
                      {(h as { admin?: { name?: string } }).admin?.name && (
                        <span className="text-neutral-400"> · {(h as { admin?: { name?: string } }).admin?.name}</span>
                      )}
                      <span className="text-neutral-400"> · {new Date(h.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Moderation action modal ───────────────────────────────────────── */}
      <Modal
        open={Boolean(selected) && modalAction !== 'removed'}
        onClose={closeModal}
        title={modalAction === 'edit' ? 'Edit review content' : `${statusLabel(modalAction)} review`}
        size="md"
      >
        {selected && modalAction && modalAction !== 'removed' && (
          <div className="space-y-4">
            {/* Review preview */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <StarRating rating={selected.rating} />
                <span className="text-xs text-neutral-400">
                  {selected.reviewer?.name || 'Anonymous'} → {selected.reviewee?.name || 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-secondary-700">{selected.message || 'No message'}</p>
            </div>

            {modalAction === 'edit' ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary-700">Updated content</label>
                <SimpleRichEditor value={edited} onChange={setEdited} />
                <p className="mt-1 text-xs text-neutral-400">Original content is preserved for audit purposes.</p>
              </div>
            ) : (
              <>
                <textarea
                  className="input w-full"
                  rows={2}
                  placeholder="Reason (public-facing context)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <textarea
                  className="input w-full"
                  rows={2}
                  placeholder="Internal moderation notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
              <Button size="sm" loading={statusMut.isPending || editMut.isPending} onClick={submitModal}>
                {modalAction === 'edit' ? 'Save changes' : statusLabel(modalAction)}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Respond modal ─────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(respondReview)}
        onClose={() => { setRespondReview(null); setResponseText(''); }}
        title={respondReview?.admin_response ? 'Edit admin response' : 'Respond to review'}
        size="md"
      >
        {respondReview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <StarRating rating={respondReview.rating} />
                <span className="text-xs text-neutral-400">by {respondReview.reviewer?.name || 'Customer'}</span>
              </div>
              <p className="text-sm text-secondary-700">{respondReview.message || 'No message'}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Admin response
                <span className="ml-1 text-xs font-normal text-neutral-400">(visible to customer)</span>
              </label>
              <textarea
                className="input w-full"
                rows={5}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write a professional response to this customer review…"
                maxLength={2000}
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{responseText.length}/2000</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => { setRespondReview(null); setResponseText(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={respondMut.isPending}
                disabled={!responseText.trim()}
                onClick={() => respondMut.mutate({ id: respondReview.id, response: responseText })}
                icon={<ChatBubbleOvalLeftIcon className="h-4 w-4" />}
              >
                {respondReview.admin_response ? 'Update response' : 'Post response'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Remove confirm ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={Boolean(selected) && modalAction === 'removed'}
        onClose={closeModal}
        title="Remove this review?"
        message="This marks the review as removed and notifies the author. The action is permanently logged."
        onConfirm={submitModal}
        loading={statusMut.isPending}
        variant="danger"
        confirmLabel="Remove review"
      />

      {/* ── Delete response confirm ───────────────────────────────────────── */}
      <ConfirmModal
        open={Boolean(deleteResponseTarget)}
        onClose={() => setDeleteResponseTarget(null)}
        title="Delete admin response?"
        message="The admin response will be removed from this review. This action is logged."
        onConfirm={() => deleteResponseTarget && deleteResponseMut.mutate(deleteResponseTarget.id)}
        loading={deleteResponseMut.isPending}
        variant="danger"
        confirmLabel="Delete response"
      />
    </>
  );
}
