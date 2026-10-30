'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { providersService } from '@/services/providers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { ResetPasswordModal } from '@/components/shared/ResetPasswordModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { Button, Badge, Tabs, StatsCard, Modal, ConfirmModal } from '@/components/ui';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  StarIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  NoSymbolIcon,
  TrashIcon,
  KeyIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { formatDate, formatDateTimeTz, formatDurationMinutes, formatJoinedDate } from '@/utils/formatDate';
import { resolveMediaUrl } from '@/lib/paths';
import { documentFieldLabel } from '@/utils/documentFieldLabels';
import { buildProviderIdentitySummary, flattenProviderStepData } from '@/utils/providerProfileSummary';
import { ProviderIdentityCard } from '@/components/providers/ProviderIdentityCard';
import { EditProviderProfileModal } from '@/components/providers/EditProviderProfileModal';
import toast from 'react-hot-toast';

const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U1RTdFQiIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOUNBM0FGIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEwIiByeD0iMzYiIHJ5PSIyOCIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';

const bookingStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success',
  in_progress: 'primary',
  confirmed: 'primary',
  assigned: 'primary',
  pending_payment: 'warning',
  cancelled: 'danger',
};

const accountStatusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

const approvalVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

const ONBOARDING_STEPS = [
  { step: 1, title: 'Registration', description: 'Basic account details' },
  { step: 2, title: 'Personal Info', description: 'Address, DOB, SSN & T-shirt size' },
  { step: 3, title: "Driver's License", description: 'License #, dates & photos' },
  { step: 4, title: 'Vehicle Info', description: 'Make, model, year, color' },
  { step: 5, title: 'Background Check', description: 'Consent agreement' },
];

const IMAGE_FIELDS = [
  'drivers_license_front',
  'drivers_license_back',
  'insurance_card_front',
  'insurance_card_back',
  'vehicle_registration_front',
  'vehicle_registration_back',
  'background_check_signed_form',
  'profile_picture',
];

// ── Activity Log helpers ──────────────────────────────────────────────────
const ACTIVITY_LABEL_MAP: Record<string, string> = {
  provider_status_active: 'Provider Status Changed to Active',
  provider_status_deactivated: 'Provider Status Changed to Deactivated',
  provider_status_suspended: 'Provider Status Changed to Suspended',
  provider_approved: 'Provider Application Approved',
  provider_rejected: 'Provider Application Rejected',
  provider_password_reset: 'Provider Password Reset',
  provider_insurance_status_change: 'Insurance Status Updated',
  provider_document_approved: 'Document Approved',
  provider_document_rejected: 'Document Rejected',
  provider_profile_updated: 'Provider Profile Updated',
  provider_profile_photo_updated: 'Provider Profile Photo Updated',
  provider_note_added: 'Note Added to Provider',
  account_deletion_request_approved: 'Account Deletion Request Approved',
  account_deletion_request_rejected: 'Account Deletion Request Rejected',
};

function formatActivityLabel(actionType: string): string {
  return (
    ACTIVITY_LABEL_MAP[actionType] ??
    actionType
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function formatActivityDetails(details: Record<string, unknown>): string | null {
  if (!details || typeof details !== 'object') return null;
  const lines: string[] = [];

  // Status change
  if (details.new_status !== undefined || details.previous_status !== undefined) {
    const prev = details.previous_status as string | undefined;
    const next = details.new_status as string | undefined;
    if (prev && next) {
      lines.push(`Status changed from "${prev}" to "${next}"`);
    } else if (next) {
      lines.push(`New status: "${next}"`);
    } else if (prev) {
      lines.push(`Previous status: "${prev}"`);
    }
  }

  // Insurance status change
  if (details.new !== undefined && details.previous !== undefined &&
      details.new_status === undefined) {
    const prev = String(details.previous);
    const next = String(details.new);
    const prevLabel = prev === 'true' ? 'Verified' : prev === 'false' ? 'Unverified' : prev;
    const nextLabel = next === 'true' ? 'Verified' : next === 'false' ? 'Unverified' : next;
    lines.push(`Insurance changed from "${prevLabel}" to "${nextLabel}"`);
  }

  // Password reset method
  if (details.method) {
    const method = String(details.method).replace(/_/g, ' ');
    lines.push(`Method: ${method}`);
  }

  // Approval status
  if (details.approval_status) {
    lines.push(`Approval: ${String(details.approval_status)}`);
  }

  // Rejection reason
  if (details.reason) {
    lines.push(`Reason: ${String(details.reason)}`);
  }

  // Document type
  if (details.document_type) {
    lines.push(`Document: ${String(details.document_type).replace(/_/g, ' ')}`);
  }

  // Changed fields (profile updates)
  if (Array.isArray(details.changed_fields) && (details.changed_fields as string[]).length > 0) {
    const fields = (details.changed_fields as string[]).map((f) => f.replace(/_/g, ' ')).join(', ');
    lines.push(`Fields updated: ${fields}`);
  }

  return lines.length > 0 ? lines.join(' · ') : null;
}
// ─────────────────────────────────────────────────────────────────────────────

function isPdfDocumentUrl(url: string) {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.pdf');
}

function DocumentViewer({ url, label }: { url: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!url) return null;

  const isPdf = isPdfDocumentUrl(url);

  if (isPdf) {
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
            <div className="flex gap-1">
              <a
                href={url}
                download
                className="rounded bg-white/20 p-1 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5 text-white" />
              </a>
              <button onClick={() => setExpanded(true)} className="rounded bg-white/20 p-1 backdrop-blur-sm">
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-lg bg-white p-2">
            <button
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 rounded-full bg-white p-1.5 shadow-lg"
            >
              <XMarkIcon className="h-5 w-5 text-secondary-900" />
            </button>
            <SafeImage
              src={url}
              alt={label}
              width={900}
              height={1200}
              className="max-h-[85vh] w-auto max-w-full object-contain rounded"
            />
            <p className="mt-2 text-center text-sm font-medium text-secondary-500">{label}</p>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProviderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: loginHistoryData, isLoading: loginHistoryLoading } = useQuery({
    queryKey: ['provider-login-history', id],
    queryFn: () => providersService.getLoginHistory(Number(id)),
    enabled: activeTab === 'login_history' && !!id,
  });
  const loginHistory = loginHistoryData?.data?.data?.login_history ?? [];
  const [bookingFilter, setBookingFilter] = useState('');
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [downloadingRecordId, setDownloadingRecordId] = useState<number | null>(null);
  const [downloadingProfilePhoto, setDownloadingProfilePhoto] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-provider-detail', id],
    queryFn: () => providersService.getById(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (params: { status: string; reason?: string }) =>
      providersService.updateStatus(Number(id), params),
    onSuccess: (_, variables) => {
      const label =
        variables.status === 'active'
          ? 'activated'
          : variables.status === 'suspended'
            ? 'suspended'
            : variables.status === 'deactivated'
              ? 'deactivated'
              : variables.status;
      toast.success(`Provider ${label} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
      setSuspendModal(false);
      setDeactivateModal(false);
      setSuspendReason('');
    },
    onError: () => toast.error('Failed to update provider status'),
  });

  const approveMutation = useMutation({
    mutationFn: () => providersService.approve(Number(id)),
    onSuccess: () => {
      toast.success('Provider approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
    },
    onError: () => toast.error('Failed to approve provider'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => providersService.reject(Number(id), reason),
    onSuccess: () => {
      toast.success('Provider rejected');
      setRejectModal(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
    },
    onError: () => toast.error('Failed to reject provider'),
  });

  const insuranceMutation = useMutation({
    mutationFn: (verified: boolean) => providersService.updateInsuranceStatus(Number(id), verified),
    onSuccess: (_, verified) => {
      toast.success(`Insurance marked as ${verified ? 'verified' : 'unverified'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
    },
    onError: () => toast.error('Failed to update insurance status'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { password?: string; notify_email?: boolean }) =>
      providersService.resetPassword(Number(id), payload).then((res) => res.data.data),
    onSuccess: () => {
      toast.success('Password updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
    },
    onError: () => toast.error('Failed to reset password'),
  });

  const profilePhotoMutation = useMutation({
    mutationFn: (file: File) => providersService.uploadProfilePhoto(Number(id), file),
    onSuccess: () => {
      toast.success('Profile photo updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-provider-detail', id] });
    },
    onError: () => toast.error('Failed to upload profile photo. Please try again.'),
  });

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Photo must be under 8 MB');
      return;
    }
    profilePhotoMutation.mutate(file);
    // Reset input so the same file can be re-selected after error
    e.target.value = '';
  };

  const handleProfilePhotoDownload = async () => {
    try {
      setDownloadingProfilePhoto(true);
      const { blob, extension } = await providersService.downloadProfilePhoto(Number(id));
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `provider-${id}-profile-photo.${extension}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success('Original profile photo downloaded');
    } catch {
      toast.error('Failed to download profile photo');
    } finally {
      setDownloadingProfilePhoto(false);
    }
  };

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
        <p className="text-sm text-neutral-300">Provider not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4" size="sm">
          Go Back
        </Button>
      </div>
    );
  }

  const handleDownloadServiceRecord = async (bookingId: number) => {
    try {
      setDownloadingRecordId(bookingId);
      const blob = await providersService.downloadServiceRecord(Number(id), bookingId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `carcomfort-service-record-${bookingId}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast.success('Service record downloaded');
    } catch {
      toast.error('Failed to download service record');
    } finally {
      setDownloadingRecordId(null);
    }
  };

  const { user, stats, bookings = [], reviews = [], audit_logs = [] } = data;
  const profile = user.driver_profile;
  const approvalStatus = profile?.approval_status || 'pending';
  const isActive = user.status === 'active';
  const isSuspended = user.status === 'suspended';
  const isDeactivated = user.status === 'deactivated';
  const canReactivate = isSuspended || isDeactivated;
  const stepData: Record<string, Record<string, unknown>> = (
    (profile?.step_data as Record<string, unknown>)?.steps || profile?.step_data || {}
  ) as Record<string, Record<string, unknown>>;
  const identity = buildProviderIdentitySummary(user, profile);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'bookings', label: 'Bookings', count: stats?.total_bookings },
    { key: 'reviews', label: 'Reviews', count: stats?.total_reviews },
    { key: 'login_history', label: 'Login Details' },
    { key: 'activity', label: 'Activity Log' },
  ];

  const statuses = ['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'];

  const allDocuments: { key: string; url: string; step: number }[] = [];
  for (const [stepNum, stepObj] of Object.entries(stepData)) {
    if (stepObj && typeof stepObj === 'object') {
      for (const [key, value] of Object.entries(stepObj)) {
        if (IMAGE_FIELDS.includes(key) && typeof value === 'string' && value) {
          allDocuments.push({ key, url: value, step: parseInt(stepNum) });
        }
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Provider Details"
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => setRejectModal(true)}
                icon={<XMarkIcon className="h-4 w-4" />}
              >
                Reject
              </Button>
            )}
            {canReactivate && (
              <Button
                variant="success"
                onClick={() => statusMutation.mutate({ status: 'active' })}
                loading={statusMutation.isPending}
                icon={<CheckCircleIcon className="h-4 w-4" />}
              >
                {isDeactivated ? 'Activate' : 'Reactivate'}
              </Button>
            )}
            {isActive && (
              <Button
                variant="warning"
                onClick={() => setSuspendModal(true)}
                icon={<NoSymbolIcon className="h-4 w-4" />}
              >
                Suspend
              </Button>
            )}
            {(isActive || isSuspended) && (
              <Button
                variant="danger"
                onClick={() => setDeactivateModal(true)}
                icon={<TrashIcon className="h-4 w-4" />}
              >
                Deactivate
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditProfileModal(true)}
              icon={<PencilIcon className="h-4 w-4" />}
            >
              Edit Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => setResetPasswordModal(true)}
              icon={<KeyIcon className="h-4 w-4" />}
            >
              Set Password
            </Button>
          </div>
        }
      />

      {/* Provider identity */}
      <div className="mb-6">
        {/* Hidden file input — triggered by the camera overlay on the profile photo */}
        <input
          id="provider-photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleProfilePhotoChange}
          disabled={profilePhotoMutation.isPending}
        />

        <ProviderIdentityCard
          summary={identity}
          onPhotoClick={() => document.getElementById('provider-photo-upload')?.click()}
          onPhotoDownload={handleProfilePhotoDownload}
          photoUploading={profilePhotoMutation.isPending}
          photoDownloading={downloadingProfilePhoto}
          badges={
            <>
              <Badge variant="primary">Provider</Badge>
              <Badge variant={accountStatusVariant[user.status] || 'neutral'} dot>
                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </Badge>
              <Badge variant={approvalVariant[approvalStatus] || 'warning'} dot>
                {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
              </Badge>
              {profile?.insurance_verified && (
                <Badge variant="success">
                  <ShieldCheckIcon className="mr-1 inline h-3 w-3" />
                  Insured
                </Badge>
              )}
              {stats?.avg_rating && (
                <span className="flex items-center gap-1 text-sm text-warning">
                  <StarIcon className="h-4 w-4 fill-warning" />
                  {stats.avg_rating}
                </span>
              )}
            </>
          }
          meta={
            <>
              <p>Joined {formatJoinedDate(user)}</p>
              {profile?.is_completed ? <p className="text-success">Onboarding Complete</p> : null}
            </>
          }
        />

        {approvalStatus === 'rejected' && profile?.approval_reason && (
          <div className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">Rejection Reason</p>
            <p className="mt-1 text-sm text-secondary-700">{profile.approval_reason}</p>
            {profile.rejected_at && (
              <p className="mt-1 text-xs text-neutral-300">
                Rejected on {formatDate(profile.rejected_at, 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        )}

        {user.status === 'suspended' && user.suspended_reason && (
          <div className="mt-4 rounded-lg border border-warning-100 bg-warning-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning">Suspension Reason</p>
            <p className="mt-1 text-sm text-secondary-700">{user.suspended_reason}</p>
            {user.suspended_at && (
              <p className="mt-1 text-xs text-neutral-300">
                Suspended on {formatDate(user.suspended_at, 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        )}

        {isDeactivated && (
          <div className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">Account deactivated</p>
            <p className="mt-1 text-sm text-secondary-700">
              This provider cannot sign in. Use Activate to restore access.
            </p>
            {user.deactivated_at && (
              <p className="mt-1 text-xs text-neutral-300">
                Deactivated on {formatDate(user.deactivated_at, 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Total Services" value={stats.total_bookings} icon={<CalendarDaysIcon className="h-5 w-5" />} />
              <StatsCard title="Completed" value={stats.completed_bookings} icon={<CheckIcon className="h-5 w-5" />} />
              <StatsCard title="Total Earnings" value={`$${stats.total_earnings}`} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
              <StatsCard title="Completion Rate" value={`${stats.completion_rate}%`} icon={<UserGroupIcon className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Service Information</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Phone', value: user.phone ? `${user.country_code || ''} ${user.phone}` : '—' },
                    { label: 'Auth Type', value: user.auth_type || '—' },
                    { label: 'Total Reviews', value: `${stats.total_reviews} (avg: ${stats.avg_rating || '—'})` },
                    { label: 'Total Earnings', value: `$${stats.total_earnings}` },
                    { label: 'Insurance', value: profile?.insurance_verified ? 'Verified' : 'Unverified' },
                    { label: 'Onboarding Step', value: `${profile?.current_step || 1} / ${ONBOARDING_STEPS.length}` },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="text-sm text-neutral-300">{item.label}</span>
                      <span className="text-sm font-medium text-secondary-900">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Insurance toggle */}
                <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-secondary-900">Insurance Verification</p>
                    <p className="text-xs text-neutral-300">Mark insurance as verified/unverified</p>
                  </div>
                  <Button
                    size="sm"
                    variant={profile?.insurance_verified ? 'danger' : 'success'}
                    onClick={() => insuranceMutation.mutate(!profile?.insurance_verified)}
                    loading={insuranceMutation.isPending}
                  >
                    {profile?.insurance_verified ? 'Mark Unverified' : 'Mark Verified'}
                  </Button>
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
                    <p className="text-sm text-neutral-300">No services yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Onboarding Progress */}
            <div className="card">
              <h3 className="mb-4 text-base font-semibold text-secondary-900">Onboarding Progress</h3>
              <div className="flex items-center gap-1">
                {ONBOARDING_STEPS.map((s) => {
                  const hasData = stepData[String(s.step)] && Object.keys(stepData[String(s.step)]).length > 0;
                  const isCurrent = s.step === (profile?.current_step || 1);
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
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" /> Completed
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-warning" /> Current
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-neutral-100" /> Pending
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            {allDocuments.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No documents uploaded yet</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {allDocuments.map((doc) => (
                    <div key={doc.key}>
                      <DocumentViewer url={doc.url} label={documentFieldLabel(doc.key)} />
                      <p className="mt-1 text-xs text-neutral-300">Step {doc.step}</p>
                    </div>
                  ))}
                </div>

                {/* Step-by-step data */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-secondary-900">Onboarding Data</h3>
                  {ONBOARDING_STEPS.map((s) => {
                    const sData = stepData[String(s.step)] as Record<string, unknown> | undefined;
                    if (!sData || Object.keys(sData).length === 0) return null;

                    const fields = Object.entries(sData).filter(
                      ([key, value]) => !IMAGE_FIELDS.includes(key) && value !== null && value !== ''
                    );
                    if (fields.length === 0) return null;

                    return (
                      <div key={s.step} className="card">
                        <h4 className="mb-3 text-sm font-semibold text-secondary-900">
                          Step {s.step}: {s.title}
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {fields.map(([key, value]) => (
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
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-secondary-600">
              Service duration is recorded from customer PIN verification through job completion (0–3 hour timer).
              Download a PDF service record for insurance, claims, or law-enforcement use. Timestamps use your configured app timezone.
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBookingFilter('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !bookingFilter ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                All ({(bookings as Array<Record<string, unknown>>).length})
              </button>
              {statuses.map((s) => {
                const count = (bookings as Array<Record<string, unknown>>).filter((b) => b.status === s).length;
                if (!count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBookingFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      bookingFilter === s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {s.replace(/_/g, ' ')} ({count})
                  </button>
                );
              })}
            </div>
            <div className="table-container">
              {(() => {
                const filtered = bookingFilter
                  ? (bookings as Array<Record<string, unknown>>).filter((b) => b.status === bookingFilter)
                  : (bookings as Array<Record<string, unknown>>);
                if (!filtered.length)
                  return <p className="py-8 text-center text-sm text-neutral-300">No bookings found</p>;
                return (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Earning</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map((b) => (
                        <tr key={b.id as number} className="hover:bg-neutral-50/50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                            {b.booking_code as string}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {(b.service_type as string)?.replace(/_/g, ' ')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={bookingStatusVariant[b.status as string] || 'neutral'} dot>
                              {(b.status as string).replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {(b.user as Record<string, unknown>)?.name as string ||
                              (b.user as Record<string, unknown>)?.email as string ||
                              '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                            {b.provider_earning != null
                              ? `$${parseFloat(String(b.provider_earning)).toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {formatDurationMinutes(b.service_duration_minutes as number | null)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                            {formatDateTimeTz((b.service_completed_at as string) || null)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => router.push(`/bookings/${b.id}`)}>
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={downloadingRecordId === (b.id as number)}
                                onClick={() => handleDownloadServiceRecord(b.id as number)}
                              >
                                PDF
                              </Button>
                            </div>
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
            {(reviews as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No reviews received</p>
            ) : (
              (reviews as Array<Record<string, unknown>>).map((r) => (
                <div key={r.id as number} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-4 w-4 ${
                                i < (r.rating as number) ? 'fill-warning text-warning' : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-secondary-900">{r.rating as number}/5</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-300">
                        From: {(r.reviewer as Record<string, unknown>)?.name as string ||
                          (r.reviewer as Record<string, unknown>)?.email as string ||
                          '—'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-200">{formatDate(r.created_at as string)}</span>
                  </div>
                  {r.message ? <p className="mt-2 text-sm text-secondary-500">{String(r.message)}</p> : null}
                </div>
              ))
            )}
          </div>
        )}

        {/* Login Details Tab */}
        {activeTab === 'login_history' && (
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-secondary-900">Login Details</h3>
            {loginHistoryLoading ? (
              <p className="py-8 text-center text-sm text-neutral-300">Loading...</p>
            ) : loginHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No device login history found</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-neutral-100">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Platform</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">App Version</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Last Login IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Last Login</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loginHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 capitalize">
                            {entry.platform ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.device_model ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.app_version ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.last_login_ip ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-400">
                          {entry.last_login_at ? formatDate(entry.last_login_at, 'MMM d, yyyy h:mm a') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.is_active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${entry.is_active ? 'bg-green-500' : 'bg-neutral-400'}`} />
                            {entry.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {(audit_logs as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No activity logs</p>
            ) : (
              (audit_logs as Array<Record<string, unknown>>).map((log) => (
                <div key={log.id as number} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100">
                    <UserGroupIcon className="h-4 w-4 text-neutral-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">
                      {formatActivityLabel(log.action_type as string)}
                    </p>
                    <p className="text-xs text-neutral-300">
                      by {(log.admin as Record<string, unknown>)?.name as string ||
                        (log.admin as Record<string, unknown>)?.email as string ||
                        'Admin'}{' '}
                      &middot; {formatDate(log.created_at as string, 'MMM d, yyyy h:mm a')}
                    </p>
                    {log.details ? (() => {
                      const readable = formatActivityDetails(log.details as Record<string, unknown>);
                      return readable ? (
                        <p className="mt-1 text-xs text-neutral-300">{readable}</p>
                      ) : null;
                    })() : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      <Modal
        open={suspendModal}
        onClose={() => { setSuspendModal(false); setSuspendReason(''); }}
        title="Suspend Provider"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-500">
            Suspending this provider will immediately block their access and prevent them from accepting new services.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-900">
              Suspension Reason (optional)
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="e.g., Multiple customer complaints..."
              className="input w-full resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setSuspendModal(false); setSuspendReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={() => statusMutation.mutate({ status: 'suspended', reason: suspendReason })}
              loading={statusMutation.isPending}
            >
              Suspend Provider
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmModal
        open={deactivateModal}
        onClose={() => setDeactivateModal(false)}
        onConfirm={() => statusMutation.mutate({ status: 'deactivated' })}
        title="Deactivate Provider"
        message="This will soft-delete the provider account. Their data will be retained but they will not be able to access the platform or accept services. Are you sure?"
        confirmLabel="Deactivate"
        variant="danger"
        loading={statusMutation.isPending}
      />

      {/* Reject Modal */}
      <Modal
        open={rejectModal}
        onClose={() => { setRejectModal(false); setRejectReason(''); }}
        title="Reject Provider"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-500">
            Provide a reason for rejecting this provider. They will be notified and can resubmit their documents.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-900">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g., Insurance card is expired, please upload a valid one..."
              className="input w-full resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(false); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate(rejectReason)}
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
            >
              Reject Provider
            </Button>
          </div>
        </div>
      </Modal>

      <ResetPasswordModal
        open={resetPasswordModal}
        onClose={() => setResetPasswordModal(false)}
        accountLabel="provider"
        userEmail={user.email}
        authType={user.auth_type}
        isSubmitting={resetPasswordMutation.isPending}
        onSubmit={(payload) => resetPasswordMutation.mutateAsync(payload)}
      />

      {editProfileModal && (
        <EditProviderProfileModal
          providerId={Number(id)}
          open={editProfileModal}
          onClose={() => setEditProfileModal(false)}
          initialValues={{
            first_name:  user.first_name  ?? user.name?.split(' ')[0] ?? '',
            last_name:   user.last_name   ?? user.name?.split(' ').slice(1).join(' ') ?? '',
            email:       user.email       ?? '',
            phone:       user.phone       ?? '',
            country_code: user.country_code ?? '',
            date_of_birth:               (flattenProviderStepData(profile?.step_data).date_of_birth as string) ?? '',
            address:                     (flattenProviderStepData(profile?.step_data).address as string) ?? '',
            social_security_number:      (flattenProviderStepData(profile?.step_data).social_security_number as string) ?? '',
            drivers_license_number:           (flattenProviderStepData(profile?.step_data).drivers_license_number as string) ?? '',
            drivers_license_issued_date:      (flattenProviderStepData(profile?.step_data).drivers_license_issued_date as string) ?? '',
            drivers_license_expiration_date:  (flattenProviderStepData(profile?.step_data).drivers_license_expiration_date as string) ?? '',
          }}
        />
      )}
    </>
  );
}
