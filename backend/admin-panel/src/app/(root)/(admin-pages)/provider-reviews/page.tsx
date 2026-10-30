'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { providerPerformanceService } from '@/services/providerPerformance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { SafeImage } from '@/components/shared/SafeImage';
import { StatsCard, Badge, Button, Pagination, Modal, Tabs, Dropdown } from '@/components/ui';
import { useTableState } from '@/hooks/useTableState';
import type { ModerationReview } from '@/types/providerPerformance';
import toast from 'react-hot-toast';
import { contentModerationService } from '@/services/contentModeration.service';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
  EyeSlashIcon,
  TrashIcon,
  FlagIcon,
  StarIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  ChatBubbleOvalLeftIcon,
  ChevronDownIcon,
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

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function ProviderReviewsPage() {
  const queryClient = useQueryClient();
  const {
    page, search, filters, queryParams,
    setPage, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at', defaultSortDirection: 'desc' });

  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ModerationReview | null>(null);
  const [modalAction, setModalAction] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [respondReview, setRespondReview] = useState<ModerationReview | null>(null);
  const [responseText, setResponseText] = useState('');
  const [deleteResponseTarget, setDeleteResponseTarget] = useState<ModerationReview | null>(null);

  const statusFilter = activeTab === 'all' ? filters.moderation_status : activeTab;
  const listParams = { ...queryParams, moderation_status: statusFilter || undefined };

  const { data: stats } = useQuery({
    queryKey: ['review-moderation-stats'],
    queryFn: () => providerPerformanceService.getReviewStats().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['review-moderation-list', listParams],
    queryFn: () => providerPerformanceService.listReviews(listParams).then((r) => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: string; reason?: string }) =>
      providerPerformanceService.updateReviewStatus(id, { status, reason }),
    onSuccess: () => {
      toast.success('Review updated');
      queryClient.invalidateQueries({ queryKey: ['review-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['review-moderation-stats'] });
      closeModal();
    },
    onError: () => toast.error('Failed to update review'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      providerPerformanceService.moderateReviewContent(id, message),
    onSuccess: () => {
      toast.success('Review updated');
      queryClient.invalidateQueries({ queryKey: ['review-moderation'] });
      closeModal();
    },
    onError: () => toast.error('Failed to edit review'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      contentModerationService.respondToReview(id, response),
    onSuccess: () => {
      toast.success('Response posted');
      queryClient.invalidateQueries({ queryKey: ['review-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['review-moderation-list'] });
      setRespondReview(null);
      setResponseText('');
    },
    onError: () => toast.error('Failed to post response'),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: (id: number) => contentModerationService.deleteReviewResponse(id),
    onSuccess: () => {
      toast.success('Response deleted');
      queryClient.invalidateQueries({ queryKey: ['review-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['review-moderation-list'] });
      setDeleteResponseTarget(null);
    },
    onError: () => toast.error('Failed to delete response'),
  });

  function openModal(review: ModerationReview, action: string) {
    setSelectedReview(review);
    setModalAction(action);
    setModerationReason('');
    setEditedMessage(review.message || '');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedReview(null);
    setModalAction('');
  }

  function handleSubmit() {
    if (!selectedReview) return;
    if (modalAction === 'edit') {
      editMutation.mutate({ id: selectedReview.id, message: editedMessage });
    } else {
      statusMutation.mutate({ id: selectedReview.id, status: modalAction, reason: moderationReason || undefined });
    }
  }

  function quickAction(review: ModerationReview, status: string) {
    statusMutation.mutate({ id: review.id, status });
  }

  const tabs = [
    { key: 'all', label: 'All', count: stats?.total },
    { key: 'pending', label: 'Pending', count: stats?.pending },
    { key: 'approved', label: 'Approved', count: stats?.approved },
    { key: 'hidden', label: 'Hidden', count: stats?.hidden },
    { key: 'removed', label: 'Removed', count: stats?.removed },
    { key: 'flagged', label: 'Flagged', count: stats?.flagged },
  ];

  return (
    <>
      <PageHeader
        title="Review Moderation"
        description="Moderate and manage customer reviews across all providers"
      />

      {/* Stats ─ 4 key metrics + avg rating */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatsCard title="Total" value={stats?.total ?? 0} icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />} />
        <StatsCard title="Pending" value={stats?.pending ?? 0} icon={<ClockIcon className="h-5 w-5" />} changeType={stats?.pending ? 'negative' : 'neutral'} />
        <StatsCard title="Approved" value={stats?.approved ?? 0} icon={<CheckCircleIcon className="h-5 w-5" />} />
        <StatsCard title="Flagged" value={stats?.flagged ?? 0} icon={<FlagIcon className="h-5 w-5" />} changeType={stats?.flagged ? 'negative' : 'neutral'} />
        <StatsCard
          title="Avg Rating"
          value={`★ ${stats?.avg_rating?.toFixed(1) ?? '—'}`}
          icon={<StarIcon className="h-5 w-5" />}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={(t) => { setActiveTab(t); setPage(1); }} />

      <div className="mt-4 mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by review text, customer or provider name…"
          filters={activeTab === 'all' ? [
            {
              key: 'moderation_status',
              label: 'All Statuses',
              value: filters.moderation_status || '',
              onChange: (v) => handleFilter('moderation_status', v),
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Hidden', value: 'hidden' },
                { label: 'Removed', value: 'removed' },
                { label: 'Flagged', value: 'flagged' },
              ],
            },
          ] : []}
        />
      </div>

      {/* Review cards */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 rounded bg-neutral-100" />
            </div>
          ))
        ) : data?.reviews.length === 0 ? (
          <div className="card py-16 text-center">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-neutral-200" />
            <p className="mt-3 text-sm text-neutral-300">No reviews found</p>
          </div>
        ) : (
          data?.reviews.map((review) => (
            <div key={review.id} className="card">

              {/* ── Header row ─────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Stars + meta */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-neutral-400">
                      <span className="font-medium text-secondary-700">{review.reviewer?.name || 'Anonymous'}</span>
                      <span className="mx-1 text-neutral-300">→</span>
                      <span className="font-medium text-secondary-700">{review.reviewee?.name || 'Unknown provider'}</span>
                    </span>
                    {review.booking && (
                      <span className="font-mono text-xs text-neutral-400">{review.booking.booking_code}</span>
                    )}
                    <span className="text-xs text-neutral-300">
                      {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Review text */}
                  {review.message ? (
                    <p className="text-sm text-secondary-800 leading-relaxed">
                      {review.message}
                    </p>
                  ) : (
                    <p className="text-sm italic text-neutral-300">No written review</p>
                  )}

                  {/* Edited original */}
                  {review.original_message && review.original_message !== review.message && (
                    <div className="mt-1 border-l-2 border-neutral-200 pl-2">
                      <p className="text-xs text-neutral-400">
                        <span className="font-medium">Original:</span> {review.original_message}
                      </p>
                    </div>
                  )}

                  {/* Admin response */}
                  {review.admin_response && (
                    <div className="mt-2 border-l-2 border-primary-300 pl-3">
                      <p className="text-xs font-semibold text-primary-600 mb-0.5">Admin response</p>
                      <p className="text-sm text-secondary-700">{review.admin_response}</p>
                      {review.admin_responded_at && (
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {new Date(review.admin_responded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Moderation info */}
                  {review.moderated_at && (
                    <p className="text-xs text-neutral-400">
                      Moderated by <span className="font-medium">{review.moderator?.name || 'Admin'}</span>
                      {' · '}{new Date(review.moderated_at).toLocaleDateString()}
                      {review.moderation_reason && <span className="italic"> — {review.moderation_reason}</span>}
                    </p>
                  )}

                  {/* Images */}
                  {review.images && review.images.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {review.images.map((img) => (
                        <SafeImage
                          key={img.id}
                          src={img.image_url}
                          alt="Review image"
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-lg object-cover ring-1 ring-neutral-100"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <Badge variant={STATUS_COLORS[review.moderation_status] || 'neutral'} dot>
                  {statusLabel(review.moderation_status)}
                </Badge>
              </div>

              {/* ── Actions ────────────────────────────────────────── */}
              <div className="mt-3 flex items-center justify-between border-t border-neutral-50 pt-3">
                {/* Primary quick-action visible at a glance */}
                {review.moderation_status === 'pending' && (
                  <button
                    onClick={() => quickAction(review, 'approved')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Approve
                  </button>
                )}
                {review.moderation_status !== 'pending' && (
                  <span className="text-xs text-neutral-300">
                    {review.moderation_status === 'approved' && 'Visible to public'}
                    {review.moderation_status === 'hidden' && 'Hidden from public'}
                    {review.moderation_status === 'removed' && 'Removed'}
                    {review.moderation_status === 'flagged' && 'Flagged for review'}
                  </span>
                )}

                {/* Actions dropdown */}
                <Dropdown
                  align="right"
                  trigger={
                    <Button variant="outline" size="sm">
                      <span className="flex items-center gap-1.5">
                        Actions
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                  }
                  items={[
                    ...(review.moderation_status !== 'approved' ? [{
                      label: 'Approve',
                      icon: <CheckCircleIcon className="h-4 w-4" />,
                      onClick: () => quickAction(review, 'approved'),
                    }] : []),
                    ...(review.moderation_status !== 'hidden' ? [{
                      label: 'Hide from public',
                      icon: <EyeSlashIcon className="h-4 w-4" />,
                      onClick: () => quickAction(review, 'hidden'),
                    }] : []),
                    ...(review.moderation_status !== 'flagged' ? [{
                      label: 'Flag for review',
                      icon: <FlagIcon className="h-4 w-4" />,
                      onClick: () => openModal(review, 'flagged'),
                    }] : []),
                    {
                      label: 'Edit content',
                      icon: <PencilIcon className="h-4 w-4" />,
                      onClick: () => openModal(review, 'edit'),
                    },
                    {
                      label: review.admin_response ? 'Edit response' : 'Respond to review',
                      icon: <ChatBubbleOvalLeftIcon className="h-4 w-4" />,
                      onClick: () => { setRespondReview(review); setResponseText(review.admin_response || ''); },
                    },
                    ...(review.admin_response ? [{
                      label: 'Delete response',
                      icon: <TrashIcon className="h-4 w-4" />,
                      onClick: () => setDeleteResponseTarget(review),
                      danger: true,
                    }] : []),
                    ...(review.moderation_status !== 'removed' ? [{
                      label: 'Remove review',
                      icon: <TrashIcon className="h-4 w-4" />,
                      onClick: () => openModal(review, 'removed'),
                      danger: true,
                    }] : []),
                  ]}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={page}
          totalPages={data?.pagination.total_pages ?? 1}
          onPageChange={setPage}
        />
      </div>

      {/* ── Moderation modal ──────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={modalAction === 'edit' ? 'Edit review content' : `${statusLabel(modalAction)} review`}
        size="md"
      >
        {selectedReview && (
          <div className="space-y-4">
            {/* Review preview */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <StarRating rating={selectedReview.rating} />
                <span className="text-xs text-neutral-400">
                  {selectedReview.reviewer?.name || 'Anonymous'} → {selectedReview.reviewee?.name || 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-secondary-700">{selectedReview.message || 'No message'}</p>
            </div>

            {modalAction === 'edit' ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary-700">Updated content</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Original content is preserved for audit purposes.
                </p>
              </div>
            ) : (
              <>
                {/* Action description */}
                <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  modalAction === 'removed' ? 'bg-danger/5 text-danger' : 'bg-neutral-50 text-secondary-700'
                }`}>
                  {modalAction === 'removed' && <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <span>
                    {modalAction === 'approved' && 'This review will be visible to the public.'}
                    {modalAction === 'hidden' && 'This review will be hidden from public view but retained in the system.'}
                    {modalAction === 'removed' && 'This review will be marked as removed and the author will be notified. This action is logged.'}
                    {modalAction === 'flagged' && 'This review will be flagged for further investigation.'}
                  </span>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                    Moderation note <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                    placeholder="Reason for this action…"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
              <Button
                variant={modalAction === 'removed' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleSubmit}
                loading={statusMutation.isPending || editMutation.isPending}
              >
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
                placeholder="Write a professional response…"
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
                loading={respondMutation.isPending}
                disabled={!responseText.trim()}
                onClick={() => respondMutation.mutate({ id: respondReview.id, response: responseText })}
                icon={<ChatBubbleOvalLeftIcon className="h-4 w-4" />}
              >
                {respondReview.admin_response ? 'Update response' : 'Post response'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete response confirm ───────────────────────────────────────── */}
      <Modal
        open={Boolean(deleteResponseTarget)}
        onClose={() => setDeleteResponseTarget(null)}
        title="Delete admin response?"
        size="sm"
      >
        {deleteResponseTarget && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-700">
              The admin response will be removed from this review. This action is logged.
            </p>
            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteResponseTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteResponseMutation.isPending}
                onClick={() => deleteResponseMutation.mutate(deleteResponseTarget.id)}
              >
                Delete response
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
