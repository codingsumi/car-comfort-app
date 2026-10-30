'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { providerPerformanceService } from '@/services/providerPerformance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  StatsCard, Badge, Button, Tabs, Modal, Input, Select,
} from '@/components/ui';
import type { VacuumPenalty, ModerationReview, ProviderFlag, ProviderDispute } from '@/types/providerPerformance';
import toast from 'react-hot-toast';
import {
  StarIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  CurrencyDollarIcon, ChatBubbleLeftRightIcon, ShieldExclamationIcon,
  ArrowLeftIcon, ClockIcon, NoSymbolIcon, FlagIcon,
  ArrowPathIcon, PencilIcon, EyeSlashIcon, TrashIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#E4101F', '#00A416', '#FFA92C', '#757D8B'];

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function ProviderPerformanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const providerId = Number(params.id);

  const [activeTab, setActiveTab] = useState('overview');
  const [chartPeriod, setChartPeriod] = useState('monthly');

  // Penalty form
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState({
    penalty_amount: '',
    deduction_type: 'fixed',
    reason: '',
    booking_id: '',
  });

  // Manual flag form
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagForm, setFlagForm] = useState({ flag_type: 'manual', severity: 'warning', notes: '' });

  // Service limit form
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitForm, setLimitForm] = useState({ daily_service_limit: '', service_limit_enabled: false });

  // Review moderation
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ModerationReview | null>(null);
  const [moderationAction, setModerationAction] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [editedMessage, setEditedMessage] = useState('');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['provider-performance-detail', providerId],
    queryFn: () => providerPerformanceService.getDetail(providerId).then((r) => r.data.data),
    enabled: !!providerId,
  });

  const { data: charts } = useQuery({
    queryKey: ['provider-performance-charts', providerId, chartPeriod],
    queryFn: () => providerPerformanceService.getCharts(providerId, chartPeriod).then((r) => r.data.data),
    enabled: !!providerId,
  });

  const { data: serviceLimit } = useQuery({
    queryKey: ['provider-service-limit', providerId],
    queryFn: () => providerPerformanceService.getServiceLimit(providerId).then((r) => r.data.data),
    enabled: !!providerId,
  });

  const penaltyMutation = useMutation({
    mutationFn: (data: Parameters<typeof providerPerformanceService.createVacuumPenalty>[1]) =>
      providerPerformanceService.createVacuumPenalty(providerId, data),
    onSuccess: () => {
      toast.success('Vacuum penalty issued');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
      setShowPenaltyModal(false);
      setPenaltyForm({ penalty_amount: '', deduction_type: 'fixed', reason: '', booking_id: '' });
    },
    onError: () => toast.error('Failed to issue penalty'),
  });

  const reversePenaltyMutation = useMutation({
    mutationFn: (penaltyId: number) => providerPerformanceService.reverseVacuumPenalty(penaltyId),
    onSuccess: () => {
      toast.success('Penalty reversed');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
    },
    onError: () => toast.error('Failed to reverse penalty'),
  });

  const limitMutation = useMutation({
    mutationFn: (data: Parameters<typeof providerPerformanceService.updateServiceLimit>[1]) =>
      providerPerformanceService.updateServiceLimit(providerId, data),
    onSuccess: () => {
      toast.success('Service limit updated');
      queryClient.invalidateQueries({ queryKey: ['provider-service-limit', providerId] });
      setShowLimitModal(false);
    },
    onError: () => toast.error('Failed to update limit'),
  });

  const reviewStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: string; reason?: string }) =>
      providerPerformanceService.updateReviewStatus(id, { status, reason }),
    onSuccess: () => {
      toast.success('Review moderation updated');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
      setShowReviewModal(false);
    },
    onError: () => toast.error('Failed to update review'),
  });

  const reviewEditMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      providerPerformanceService.moderateReviewContent(id, message),
    onSuccess: () => {
      toast.success('Review content updated');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
      setShowReviewModal(false);
    },
    onError: () => toast.error('Failed to edit review'),
  });

  const resolveFlagMutation = useMutation({
    mutationFn: ({ flagId, note }: { flagId: number; note?: string }) =>
      providerPerformanceService.resolveFlag(flagId, note),
    onSuccess: () => {
      toast.success('Flag resolved');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
    },
    onError: () => toast.error('Failed to resolve flag'),
  });

  const createFlagMutation = useMutation({
    mutationFn: (data: { flag_type: string; severity: string; notes: string }) =>
      providerPerformanceService.createManualFlag(providerId, data),
    onSuccess: () => {
      toast.success('Provider flagged successfully');
      queryClient.invalidateQueries({ queryKey: ['provider-performance-detail', providerId] });
      setShowFlagModal(false);
      setFlagForm({ flag_type: 'manual', severity: 'warning', notes: '' });
    },
    onError: () => toast.error('Failed to flag provider'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="h-16 rounded bg-neutral-100" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-300">Provider not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/provider-performance')}>Go Back</Button>
      </div>
    );
  }

  const { user, metrics } = detail;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'reviews', label: 'Reviews', count: detail.reviews.length },
    { key: 'complaints', label: 'Complaints', count: detail.disputes.length },
    { key: 'penalties', label: 'Penalties', count: detail.vacuum_penalties.length },
    { key: 'flags', label: 'Flags', count: detail.flags.filter((f) => !f.resolved).length },
    { key: 'limits', label: 'Service Limit' },
  ];

  function openReviewModal(review: ModerationReview, action: string) {
    setSelectedReview(review);
    setModerationAction(action);
    setModerationReason('');
    setEditedMessage(review.message || '');
    setShowReviewModal(true);
  }

  function handlePenaltySubmit() {
    const amount = parseFloat(penaltyForm.penalty_amount);
    if (!amount || amount <= 0) return toast.error('Enter a valid penalty amount');
    if (!penaltyForm.reason.trim()) return toast.error('Reason is required');

    penaltyMutation.mutate({
      penalty_amount: amount,
      deduction_type: penaltyForm.deduction_type,
      reason: penaltyForm.reason,
      booking_id: penaltyForm.booking_id ? parseInt(penaltyForm.booking_id) : undefined,
    });
  }

  function handleLimitSubmit() {
    limitMutation.mutate({
      daily_service_limit: limitForm.daily_service_limit ? parseInt(limitForm.daily_service_limit) : null,
      service_limit_enabled: limitForm.service_limit_enabled,
    });
  }

  function handleReviewSubmit() {
    if (!selectedReview) return;
    if (moderationAction === 'edit') {
      reviewEditMutation.mutate({ id: selectedReview.id, message: editedMessage });
    } else {
      reviewStatusMutation.mutate({
        id: selectedReview.id,
        status: moderationAction,
        reason: moderationReason || undefined,
      });
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <Link href="/provider-performance" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-300 hover:text-secondary-700">
          <ArrowLeftIcon className="h-4 w-4" /> Back to Performance Dashboard
        </Link>
        <PageHeader
          title={user.name || 'Provider'}
          description={`${user.email} ${user.phone ? `· ${user.phone}` : ''}`}
          actions={
            <div className="flex items-center gap-2">
              <Badge variant={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : 'neutral'} dot>
                {user.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => {
                setLimitForm({
                  daily_service_limit: String(user.daily_service_limit || ''),
                  service_limit_enabled: user.service_limit_enabled || false,
                });
                setShowLimitModal(true);
              }}>
                Service Limit
              </Button>
              <Button variant="warning" size="sm" icon={<FlagIcon className="h-4 w-4" />} onClick={() => setShowFlagModal(true)}>
                Flag Provider
              </Button>
              <Button variant="danger" size="sm" icon={<NoSymbolIcon className="h-4 w-4" />} onClick={() => setShowPenaltyModal(true)}>
                Issue Penalty
              </Button>
            </div>
          }
        />
      </div>

      {/* Profile + Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard title="Avg Rating" value={metrics.avg_rating?.toFixed(1) ?? 'N/A'} icon={<StarIcon className="h-5 w-5" />} />
        <StatsCard title="Completed" value={metrics.total_completed_services} icon={<CheckCircleIcon className="h-5 w-5" />} />
        <StatsCard title="Cancelled" value={metrics.total_cancelled_services} icon={<XCircleIcon className="h-5 w-5" />} />
        <StatsCard title="Completion Rate" value={`${metrics.completion_rate}%`} icon={<ArrowPathIcon className="h-5 w-5" />} />
        <StatsCard title="Earnings" value={formatCurrency(metrics.total_earnings)} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
        <StatsCard title="Satisfaction" value={`${metrics.satisfaction_score}%`} icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />} />
        <StatsCard title="Complaints" value={metrics.complaint_count} icon={<ExclamationTriangleIcon className="h-5 w-5" />} changeType={metrics.complaint_count > 3 ? 'negative' : 'neutral'} />
        <StatsCard title="Penalty Total" value={formatCurrency(metrics.vacuum_penalty_total)} icon={<ShieldExclamationIcon className="h-5 w-5" />} />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* Overview Tab - Charts */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Select
                label="Period"
                options={[
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
                className="w-36"
              />
            </div>

            {/* Earnings Trend */}
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Earnings Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.earnings_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), undefined]} />
                    <Legend />
                    <Area type="monotone" dataKey="earnings" name="Earnings" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ratings Over Time */}
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Ratings Over Time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts?.ratings_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="avg_rating" name="Avg Rating" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Service Completion */}
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Service Completion Trends</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.completion_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Complaint Trend */}
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Complaint Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.complaint_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Complaints" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {detail.reviews.length === 0 ? (
              <div className="card py-12 text-center text-neutral-300">No reviews yet</div>
            ) : (
              detail.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onApprove={() => openReviewModal(review, 'approved')}
                  onHide={() => openReviewModal(review, 'hidden')}
                  onRemove={() => openReviewModal(review, 'removed')}
                  onFlag={() => openReviewModal(review, 'flagged')}
                  onEdit={() => openReviewModal(review, 'edit')}
                />
              ))
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {detail.disputes.length === 0 ? (
              <div className="card py-12 text-center text-neutral-300">No complaints</div>
            ) : (
              detail.disputes.map((dispute) => (
                <DisputeCard key={dispute.id} dispute={dispute} />
              ))
            )}
          </div>
        )}

        {/* Penalties Tab */}
        {activeTab === 'penalties' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-300">
                  Total deductions: <span className="font-semibold text-danger">{formatCurrency(metrics.vacuum_penalty_total)}</span>
                </p>
              </div>
              <Button size="sm" variant="danger" icon={<NoSymbolIcon className="h-4 w-4" />} onClick={() => setShowPenaltyModal(true)}>
                Add Penalty
              </Button>
            </div>
            {detail.vacuum_penalties.length === 0 ? (
              <div className="card py-12 text-center text-neutral-300">No vacuum penalties</div>
            ) : (
              detail.vacuum_penalties.map((penalty) => (
                <PenaltyCard
                  key={penalty.id}
                  penalty={penalty}
                  onReverse={() => reversePenaltyMutation.mutate(penalty.id)}
                  reversing={reversePenaltyMutation.isPending}
                />
              ))
            )}
          </div>
        )}

        {/* Flags Tab */}
        {activeTab === 'flags' && (
          <div className="space-y-4">
            {detail.flags.length === 0 ? (
              <div className="card py-12 text-center text-neutral-300">No flags</div>
            ) : (
              detail.flags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  onResolve={(note) => resolveFlagMutation.mutate({ flagId: flag.id, note })}
                  resolving={resolveFlagMutation.isPending}
                />
              ))
            )}
          </div>
        )}

        {/* Service Limit Tab */}
        {activeTab === 'limits' && (
          <div className="card max-w-lg">
            <h3 className="mb-4 text-sm font-semibold text-secondary-900">Daily Service Limit</h3>
            {serviceLimit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-300">Limit Status</p>
                    <Badge variant={serviceLimit.service_limit_enabled ? 'success' : 'neutral'} dot>
                      {serviceLimit.service_limit_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-300">Daily Limit</p>
                    <p className="text-lg font-bold text-secondary-900">{serviceLimit.daily_service_limit ?? 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-300">Today Completed</p>
                    <p className="text-lg font-bold text-secondary-900">{serviceLimit.today_completed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-300">Remaining Slots</p>
                    <p className={`text-lg font-bold ${serviceLimit.limit_reached ? 'text-danger' : 'text-success'}`}>
                      {serviceLimit.remaining_slots !== null ? serviceLimit.remaining_slots : '∞'}
                    </p>
                  </div>
                </div>
                {serviceLimit.limit_reached && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-4 py-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-danger" />
                    <p className="text-sm font-medium text-danger">Daily service limit reached</p>
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={() => {
                  setLimitForm({
                    daily_service_limit: String(serviceLimit.daily_service_limit || ''),
                    service_limit_enabled: serviceLimit.service_limit_enabled,
                  });
                  setShowLimitModal(true);
                }}>
                  Edit Limit
                </Button>
              </div>
            ) : (
              <p className="text-sm text-neutral-300">Loading...</p>
            )}
          </div>
        )}
      </div>

      {/* Penalty Modal */}
      <Modal open={showPenaltyModal} onClose={() => setShowPenaltyModal(false)} title="Issue Vacuum Fee Deduction" size="md">
        <div className="space-y-4">
          {/* CarComfort reason presets */}
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Quick Reason</label>
            <div className="flex flex-wrap gap-2">
              {[
                'Provider refused to vacuum the customer\'s vehicle',
                'Vacuum service did not meet CarComfort policy standards',
                'Vacuum equipment malfunction — service not completed',
                'Customer reported unsatisfactory vacuum quality',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPenaltyForm((f) => ({ ...f, reason: preset }))}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    penaltyForm.reason === preset
                      ? 'border-danger bg-danger text-white'
                      : 'border-neutral-200 bg-white text-secondary-700 hover:border-danger hover:text-danger'
                  }`}
                >
                  {preset.length > 45 ? preset.slice(0, 45) + '…' : preset}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Penalty Amount ($)"
              type="number"
              value={penaltyForm.penalty_amount}
              onChange={(e) => setPenaltyForm((f) => ({ ...f, penalty_amount: e.target.value }))}
              placeholder="25.00"
            />
            <Select
              label="Deduction Type"
              options={[
                { label: 'Fixed Amount ($)', value: 'fixed' },
                { label: 'Percentage (%)', value: 'percentage' },
              ]}
              value={penaltyForm.deduction_type}
              onChange={(e) => setPenaltyForm((f) => ({ ...f, deduction_type: e.target.value }))}
            />
          </div>
          <Input
            label="Booking ID (optional)"
            type="number"
            value={penaltyForm.booking_id}
            onChange={(e) => setPenaltyForm((f) => ({ ...f, booking_id: e.target.value }))}
            placeholder="Link to a specific booking"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Reason <span className="text-danger">*</span></label>
            <textarea
              className="input w-full"
              rows={3}
              value={penaltyForm.reason}
              onChange={(e) => setPenaltyForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the reason for this deduction..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPenaltyModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handlePenaltySubmit} loading={penaltyMutation.isPending}>
              Issue Deduction
            </Button>
          </div>
        </div>
      </Modal>

      {/* Service Limit Modal */}
      <Modal open={showLimitModal} onClose={() => setShowLimitModal(false)} title="Update Service Limit" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-secondary-700">Enable Limit</label>
            <button
              type="button"
              onClick={() => setLimitForm((f) => ({ ...f, service_limit_enabled: !f.service_limit_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${limitForm.service_limit_enabled ? 'bg-primary' : 'bg-neutral-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${limitForm.service_limit_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <Input
            label="Daily Service Limit"
            type="number"
            value={limitForm.daily_service_limit}
            onChange={(e) => setLimitForm((f) => ({ ...f, daily_service_limit: e.target.value }))}
            placeholder="e.g., 4"
            disabled={!limitForm.service_limit_enabled}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowLimitModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleLimitSubmit} loading={limitMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Review Moderation Modal */}
      <Modal open={showReviewModal} onClose={() => setShowReviewModal(false)} title={moderationAction === 'edit' ? 'Edit Review Content' : 'Moderate Review'} size="md">
        {selectedReview && (
          <div className="space-y-4">
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon key={i} className={`h-4 w-4 ${i < selectedReview.rating ? 'fill-warning text-warning' : 'text-neutral-200'}`} />
                  ))}
                </div>
                <span className="text-xs text-neutral-300">by {selectedReview.reviewer?.name || 'Anonymous'}</span>
              </div>
              <p className="text-sm text-secondary-700">{selectedReview.message || 'No message'}</p>
            </div>

            {moderationAction === 'edit' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">Edited Content</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-secondary-700">
                  {moderationAction === 'approved' && 'Approve this review to make it publicly visible.'}
                  {moderationAction === 'hidden' && 'Hide this review from public view.'}
                  {moderationAction === 'removed' && 'Remove this review permanently.'}
                  {moderationAction === 'flagged' && 'Flag this review for further investigation.'}
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary-700">Reason (optional)</label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                    placeholder="Add a moderation note..."
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReviewModal(false)}>Cancel</Button>
              <Button
                variant={moderationAction === 'removed' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleReviewSubmit}
                loading={reviewStatusMutation.isPending || reviewEditMutation.isPending}
              >
                {moderationAction === 'edit' ? 'Save Changes' : `${moderationAction.charAt(0).toUpperCase() + moderationAction.slice(1)} Review`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Flag Modal */}
      <Modal open={showFlagModal} onClose={() => setShowFlagModal(false)} title="Flag Provider" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            Manually flag this provider for admin review. They will appear highlighted in the performance dashboard.
          </p>
          <Select
            label="Flag Type"
            options={[
              { label: 'Manual Review Required', value: 'manual' },
              { label: 'Low Rating', value: 'low_rating' },
              { label: 'High Cancellation Rate', value: 'high_cancellation' },
              { label: 'High Complaints', value: 'high_complaints' },
              { label: 'Vacuum Policy Violation', value: 'vacuum_policy' },
              { label: 'Late Arrivals', value: 'late_arrivals' },
              { label: 'Excessive Disputes', value: 'excessive_disputes' },
            ]}
            value={flagForm.flag_type}
            onChange={(e) => setFlagForm((f) => ({ ...f, flag_type: e.target.value }))}
          />
          <Select
            label="Severity"
            options={[
              { label: 'Warning', value: 'warning' },
              { label: 'Critical', value: 'critical' },
            ]}
            value={flagForm.severity}
            onChange={(e) => setFlagForm((f) => ({ ...f, severity: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Notes (optional)</label>
            <textarea
              className="input w-full"
              rows={3}
              value={flagForm.notes}
              onChange={(e) => setFlagForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Add context for this flag..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFlagModal(false)}>Cancel</Button>
            <Button
              variant="warning"
              size="sm"
              onClick={() => createFlagMutation.mutate(flagForm)}
              loading={createFlagMutation.isPending}
            >
              Flag Provider
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Sub-components

function ReviewCard({ review, onApprove, onHide, onRemove, onFlag, onEdit }: {
  review: ModerationReview;
  onApprove: () => void;
  onHide: () => void;
  onRemove: () => void;
  onFlag: () => void;
  onEdit: () => void;
}) {
  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
    pending: 'warning',
    approved: 'success',
    hidden: 'neutral',
    removed: 'danger',
    flagged: 'primary',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <StarIcon key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-warning text-warning' : 'text-neutral-200'}`} />
            ))}
          </div>
          <Badge variant={statusColors[review.moderation_status] || 'neutral'}>
            {review.moderation_status}
          </Badge>
          {review.booking && (
            <span className="text-xs text-neutral-300">Booking: {review.booking.booking_code}</span>
          )}
        </div>
        <span className="text-xs text-neutral-300">{new Date(review.created_at).toLocaleDateString()}</span>
      </div>
      <p className="mt-2 text-sm text-secondary-700">{review.message || 'No message'}</p>
      {review.original_message && review.original_message !== review.message && (
        <p className="mt-1 text-xs text-neutral-300 italic">Original: {review.original_message}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-neutral-300">By: {review.reviewer?.name || 'Anonymous'}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onApprove} icon={<CheckCircleIcon className="h-3.5 w-3.5" />}>Approve</Button>
          <Button variant="ghost" size="sm" onClick={onHide} icon={<EyeSlashIcon className="h-3.5 w-3.5" />}>Hide</Button>
          <Button variant="ghost" size="sm" onClick={onEdit} icon={<PencilIcon className="h-3.5 w-3.5" />}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onFlag} icon={<FlagIcon className="h-3.5 w-3.5" />}>Flag</Button>
          <Button variant="ghost" size="sm" onClick={onRemove} icon={<TrashIcon className="h-3.5 w-3.5 text-danger" />} />
        </div>
      </div>
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: ProviderDispute }) {
  const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
    open: 'danger',
    investigating: 'warning',
    resolved: 'success',
    closed: 'neutral',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[dispute.status] || 'neutral'} dot>{dispute.status}</Badge>
          {dispute.booking && <span className="text-xs text-neutral-300">Booking: {dispute.booking.booking_code}</span>}
        </div>
        <span className="text-xs text-neutral-300">{new Date(dispute.created_at).toLocaleDateString()}</span>
      </div>
      {dispute.customer_complaint && (
        <div className="mt-2">
          <p className="text-xs font-medium text-neutral-300">Customer Complaint</p>
          <p className="text-sm text-secondary-700">{dispute.customer_complaint}</p>
        </div>
      )}
      {dispute.provider_response && (
        <div className="mt-2">
          <p className="text-xs font-medium text-neutral-300">Provider Response</p>
          <p className="text-sm text-secondary-700">{dispute.provider_response}</p>
        </div>
      )}
      {dispute.admin_notes && (
        <div className="mt-2">
          <p className="text-xs font-medium text-neutral-300">Admin Notes</p>
          <p className="text-sm text-secondary-700">{dispute.admin_notes}</p>
        </div>
      )}
    </div>
  );
}

function PenaltyCard({ penalty, onReverse, reversing }: {
  penalty: VacuumPenalty;
  onReverse: () => void;
  reversing: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-danger">${parseFloat(penalty.penalty_amount).toFixed(2)}</span>
          <Badge variant={penalty.status === 'reversed' ? 'neutral' : penalty.status === 'applied' ? 'danger' : 'warning'}>
            {penalty.status}
          </Badge>
          <Badge variant="neutral">{penalty.deduction_type}</Badge>
        </div>
        <span className="text-xs text-neutral-300">{new Date(penalty.created_at).toLocaleDateString()}</span>
      </div>
      <p className="mt-2 text-sm text-secondary-700">{penalty.reason}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-neutral-300">
          {penalty.booking && <span>Booking: {penalty.booking.booking_code}</span>}
          {penalty.issuer && <span>Issued by: {penalty.issuer.name}</span>}
        </div>
        {penalty.status === 'applied' && (
          <Button variant="outline" size="sm" onClick={onReverse} loading={reversing}>Reverse</Button>
        )}
      </div>
    </div>
  );
}

function FlagCard({ flag, onResolve, resolving }: {
  flag: ProviderFlag;
  onResolve: (note?: string) => void;
  resolving: boolean;
}) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const flagLabels: Record<string, string> = {
    low_rating: 'Low Rating',
    high_cancellation: 'High Cancellation Rate',
    high_complaints: 'High Complaints',
    excessive_disputes: 'Excessive Disputes',
    late_arrivals: 'Late Arrivals',
    manual: 'Manual Flag',
  };

  return (
    <div className={`card border-l-4 ${flag.severity === 'critical' ? 'border-l-danger' : 'border-l-warning'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={flag.severity === 'critical' ? 'danger' : 'warning'} dot>
            {flagLabels[flag.flag_type] || flag.flag_type}
          </Badge>
          <Badge variant={flag.resolved ? 'success' : 'neutral'}>
            {flag.resolved ? 'Resolved' : 'Active'}
          </Badge>
          <Badge variant="neutral">{flag.flagged_by}</Badge>
        </div>
        <span className="text-xs text-neutral-300">{new Date(flag.created_at).toLocaleDateString()}</span>
      </div>
      {flag.details && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(flag.details).map(([k, v]) => (
            <span key={k} className="rounded bg-neutral-50 px-2 py-1 text-xs text-secondary-700">
              {k.replace(/_/g, ' ')}: {String(v)}
            </span>
          ))}
        </div>
      )}
      {flag.resolved && (
        <div className="mt-2 text-xs text-neutral-300">
          Resolved by {flag.resolver?.name || 'Admin'} {flag.resolved_at ? `on ${new Date(flag.resolved_at).toLocaleDateString()}` : ''}
          {flag.resolution_note && <span> &mdash; {flag.resolution_note}</span>}
        </div>
      )}
      {!flag.resolved && (
        <div className="mt-3">
          {showNote ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea className="input w-full text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)" />
              </div>
              <Button size="sm" onClick={() => onResolve(note)} loading={resolving}>Resolve</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNote(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowNote(true)}>Resolve Flag</Button>
          )}
        </div>
      )}
    </div>
  );
}
