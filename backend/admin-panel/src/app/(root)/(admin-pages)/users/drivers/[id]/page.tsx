'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { usersService } from '@/services/users.service';
import { driversService } from '@/services/drivers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { SafeImage } from '@/components/shared/SafeImage';
import { Button, Badge, Tabs, StatsCard, Modal } from '@/components/ui';
import {
  ArrowLeftIcon, CheckIcon, XMarkIcon, CalendarDaysIcon,
  CurrencyDollarIcon, StarIcon, UserGroupIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { formatDate, formatJoinedDate } from '@/utils/formatDate';
import { resolveMediaUrl } from '@/lib/paths';
import { documentFieldLabel } from '@/utils/documentFieldLabels';
import { buildProviderIdentitySummary } from '@/utils/providerProfileSummary';
import { ProviderIdentityCard } from '@/components/providers/ProviderIdentityCard';
import toast from 'react-hot-toast';
import type { Booking, Review } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U1RTdFQiIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOUNBM0FGIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEwIiByeD0iMzYiIHJ5PSIyOCIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';

const ONBOARDING_STEPS = [
  { step: 1, title: 'Registration', description: 'Basic account details' },
  { step: 2, title: 'Personal Info', description: 'Address, DOB, SSN & T-shirt size' },
  { step: 3, title: "Driver's License", description: 'License #, dates & photos' },
  { step: 4, title: 'Vehicle Info', description: 'Make, model, year, color' },
  { step: 5, title: 'Background Check', description: 'Consent agreement' },
];

const bookingStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success', in_progress: 'primary', confirmed: 'primary', assigned: 'primary',
  pending_payment: 'warning', cancelled: 'danger',
};

function isPdfDocumentUrl(url: string) {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.pdf');
}

function DocumentViewer({ url, label }: { url: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!url) return null;

  if (isPdfDocumentUrl(url)) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </p>
        <p className="mb-3 text-center text-sm text-secondary-600">PDF document</p>
        <a
          href={resolveMediaUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          View PDF
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="group relative h-40 w-full overflow-hidden rounded-lg border border-neutral-100">
        <SafeImage
          src={url}
          alt={label}
          fallbackSrc={DEFAULT_AVATAR}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="cursor-pointer object-cover transition-transform group-hover:scale-105"
          onClick={() => setExpanded(true)}
        />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex w-full items-center justify-between p-2">
            <span className="text-xs font-medium text-white">{label}</span>
            <button onClick={() => setExpanded(true)} className="rounded bg-white/20 p-1 backdrop-blur-sm">
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setExpanded(false)}>
          <div className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-lg bg-white p-2">
            <button
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 rounded-full bg-white p-1.5 shadow-lg"
            >
              <XMarkIcon className="h-5 w-5 text-secondary-900" />
            </button>
            <SafeImage src={url} alt={label} width={900} height={1200} className="max-h-[85vh] w-auto max-w-full object-contain rounded" />
            <p className="mt-2 text-center text-sm font-medium text-secondary-500">{label}</p>
          </div>
        </div>
      )}
    </>
  );
}

function StepDataSection({ stepNum, data }: { stepNum: number; data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-neutral-300 italic">No data submitted</p>;
  }

  const imageFields = [
    'drivers_license_front', 'drivers_license_back',
    'insurance_card_front', 'insurance_card_back',
    'vehicle_registration_front', 'vehicle_registration_back',
    'background_check_signed_form',
    'profile_picture',
  ];

  const images: { key: string; url: string }[] = [];
  const fields: { key: string; value: unknown }[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (imageFields.includes(key) && typeof value === 'string' && value) {
      images.push({ key, url: value });
    } else {
      fields.push({ key, value });
    }
  }

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map(({ key, value }) => (
            <div key={key} className="flex flex-col rounded-lg bg-neutral-50 p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-300">
                {key.replace(/_/g, ' ')}
              </span>
              <span className="mt-0.5 text-sm font-medium text-secondary-900">
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—')}
              </span>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map(({ key, url }) => (
            <DocumentViewer key={key} url={url} label={documentFieldLabel(key)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DriverDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [bookingFilter, setBookingFilter] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['driver-detail', id],
    queryFn: () => usersService.getById(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => driversService.approve(Number(id)),
    onSuccess: () => {
      toast.success('Service provider approved successfully');
      queryClient.invalidateQueries({ queryKey: ['driver-detail', id] });
    },
    onError: () => toast.error('Failed to approve service provider'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => driversService.reject(Number(id), reason),
    onSuccess: () => {
      toast.success('Service provider rejected. Notification sent to service provider.');
      setRejectModalOpen(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['driver-detail', id] });
    },
    onError: () => toast.error('Failed to reject service provider'),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-sm text-neutral-300">Service provider not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4" size="sm">Go Back</Button>
      </div>
    );
  }

  const { user, stats, bookings = [], reviews = [], driverProfile } = data;
  const approvalStatus = driverProfile?.approval_status || 'pending';
  const approvalVariant: Record<string, 'success' | 'warning' | 'danger'> = { approved: 'success', pending: 'warning', rejected: 'danger' };
  const stepData: Record<string, Record<string, unknown>> = (driverProfile?.step_data?.steps || driverProfile?.step_data || {}) as Record<string, Record<string, unknown>>;
  const currentStep = driverProfile?.current_step || 1;
  const identity = buildProviderIdentitySummary(user, driverProfile);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'onboarding', label: 'Onboarding Data' },
    { key: 'bookings', label: 'Bookings', count: stats?.total_bookings },
    { key: 'reviews', label: 'Reviews', count: stats?.total_reviews },
  ];

  const statuses = ['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'];

  return (
    <>
      <PageHeader
        title="Service Provider Details"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeftIcon className="h-4 w-4" />}>
              Back
            </Button>
            {(approvalStatus === 'pending' || approvalStatus === 'rejected') && (
              <Button
                variant="success"
                onClick={() => approveMutation.mutate()}
                loading={approveMutation.isPending}
                icon={<CheckIcon className="h-4 w-4" />}
              >
                Approve
              </Button>
            )}
            {(approvalStatus === 'pending' || approvalStatus === 'approved') && (
              <Button
                variant="danger"
                onClick={() => setRejectModalOpen(true)}
                icon={<XMarkIcon className="h-4 w-4" />}
              >
                Reject
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6">
        <ProviderIdentityCard
          summary={identity}
          badges={
            <>
              <Badge variant="success">Service Provider</Badge>
              <Badge variant={approvalVariant[approvalStatus] || 'warning'} dot>
                {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
              </Badge>
              {driverProfile?.is_completed ? <Badge variant="primary">Onboarding Complete</Badge> : null}
              {stats?.avg_rating ? (
                <span className="flex items-center gap-1 text-sm text-warning">
                  <StarIcon className="h-4 w-4 fill-warning" />
                  {stats.avg_rating}
                </span>
              ) : null}
            </>
          }
          meta={
            <>
              <p>Joined {formatJoinedDate(user)}</p>
              <p>Step {currentStep} / {ONBOARDING_STEPS.length}</p>
            </>
          }
        />

        {approvalStatus === 'rejected' && driverProfile?.approval_reason && (
          <div className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">Rejection Reason</p>
            <p className="mt-1 text-sm text-secondary-700">{driverProfile.approval_reason}</p>
            <p className="mt-1 text-xs text-neutral-300">Rejected on {formatDate(driverProfile.rejected_at, 'MMM d, yyyy h:mm a')}</p>
          </div>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Total Bookings" value={stats.total_bookings} icon={<CalendarDaysIcon className="h-5 w-5" />} />
              <StatsCard title="Completed" value={stats.completed_bookings || 0} icon={<CheckIcon className="h-5 w-5" />} />
              <StatsCard title="Total Earnings" value={`$${stats.total_earnings || '0.00'}`} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
              <StatsCard title="Completion Rate" value={`${stats.completion_rate || 0}%`} icon={<UserGroupIcon className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Contact Info</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Phone', value: user.phone ? `${user.country_code || ''} ${user.phone}` : '—' },
                    { label: 'Auth Type', value: user.auth_type || '—' },
                    { label: 'Verified', value: user.is_verified ? 'Yes' : 'No' },
                    { label: 'Referral Code', value: user.referral_code || '—' },
                    { label: 'Reviews', value: `${stats.total_reviews} (avg: ${stats.avg_rating || '—'})` },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="text-sm text-neutral-300">{item.label}</span>
                      <span className="text-sm font-medium text-secondary-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Booking Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(stats.status_breakdown || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={bookingStatusVariant[status] || 'neutral'} dot>
                        {status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm font-semibold text-secondary-900">{count as number}</span>
                    </div>
                  ))}
                  {Object.keys(stats.status_breakdown || {}).length === 0 && (
                    <p className="text-sm text-neutral-300">No bookings yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Onboarding Progress Bar */}
            <div className="card">
              <h3 className="mb-4 text-base font-semibold text-secondary-900">Onboarding Progress</h3>
              <div className="flex items-center gap-1">
                {ONBOARDING_STEPS.map((s) => {
                  const hasData = stepData[String(s.step)] && Object.keys(stepData[String(s.step)]).length > 0;
                  const isCurrent = s.step === currentStep;
                  return (
                    <div key={s.step} className="flex flex-1 flex-col items-center">
                      <div
                        className={`h-2 w-full rounded-full ${
                          hasData ? 'bg-success' : isCurrent ? 'bg-warning' : 'bg-neutral-100'
                        }`}
                      />
                      <span className="mt-1 text-[10px] text-neutral-300">{s.step}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-neutral-300">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-success" /> Completed</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-warning" /> Current</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-neutral-100" /> Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* Onboarding Data Tab */}
        {activeTab === 'onboarding' && (
          <div className="space-y-4">
            {ONBOARDING_STEPS.map((s) => {
              const data = stepData[String(s.step)] as Record<string, unknown> | undefined;
              const hasData = data && Object.keys(data).length > 0;
              const isCompleted = hasData;
              const isCurrent = s.step === currentStep && !hasData;

              return (
                <div key={s.step} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isCompleted ? 'bg-success text-white' : isCurrent ? 'bg-warning text-white' : 'bg-neutral-100 text-neutral-300'
                      }`}>
                        {isCompleted ? <CheckIcon className="h-4 w-4" /> : s.step}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-secondary-900">{s.title}</h4>
                        <p className="text-xs text-neutral-300">{s.description}</p>
                      </div>
                    </div>
                    <Badge variant={isCompleted ? 'success' : isCurrent ? 'warning' : 'neutral'}>
                      {isCompleted ? 'Submitted' : isCurrent ? 'In Progress' : 'Pending'}
                    </Badge>
                  </div>
                  {hasData && (
                    <div className="mt-4 border-t border-neutral-100 pt-4">
                      <StepDataSection stepNum={s.step} data={data} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBookingFilter('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!bookingFilter ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}
              >
                All ({bookings.length})
              </button>
              {statuses.map((s) => {
                const count = bookings.filter((b: Booking) => b.status === s).length;
                if (!count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBookingFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${bookingFilter === s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}
                  >
                    {s.replace(/_/g, ' ')} ({count})
                  </button>
                );
              })}
            </div>
            <div className="table-container">
              {(() => {
                const filtered = bookingFilter ? bookings.filter((b: Booking) => b.status === bookingFilter) : bookings;
                if (!filtered.length) return <p className="py-8 text-center text-sm text-neutral-300">No bookings found</p>;
                return (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map((b: Booking) => (
                        <tr key={b.id} className="hover:bg-neutral-50/50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">{b.booking_code}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">{b.service_type?.replace(/_/g, ' ')}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={bookingStatusVariant[b.status] || 'neutral'} dot>{b.status.replace(/_/g, ' ')}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {b.user?.name || b.user?.email || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                            {b.total_price ? formatCurrency(b.total_price) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                            {formatDate(b.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No reviews received</p>
            ) : (
              reviews.map((r: Review) => (
                <div key={r.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-4 w-4 ${i < r.rating ? 'fill-warning text-warning' : 'text-neutral-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-secondary-900">{r.rating}/5</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-300">
                        From: {r.reviewer?.name || r.reviewer?.email || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-200">{formatDate(r.created_at)}</span>
                  </div>
                  {r.message && <p className="mt-2 text-sm text-secondary-500">{r.message}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setRejectReason(''); }}
        title="Reject Service Provider"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-500">
            Provide a reason for rejecting this service provider&apos;s onboarding. The service provider will receive an email and SMS notification with this reason and can resubmit their data.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-900">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g., Driver's license photo is blurry, please resubmit a clear image..."
              className="input w-full resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModalOpen(false); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate(rejectReason)}
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
