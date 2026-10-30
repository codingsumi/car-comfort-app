'use client';

import { useState, type ReactNode } from 'react';
import { SafeImage } from '@/components/shared/SafeImage';
import { resolveMediaUrl } from '@/lib/paths';
import { Modal } from '@/components/ui';
import type { ProviderIdentitySummary } from '@/utils/providerProfileSummary';
import { ArrowDownTrayIcon, CameraIcon, EyeIcon } from '@heroicons/react/24/solid';

const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U1RTdFQiIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOUNBM0FGIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEwIiByeD0iMzYiIHJ5PSIyOCIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
      <dt className="text-sm font-medium text-neutral-400">{label}</dt>
      <dd className="text-sm font-medium text-secondary-900 break-words">{value}</dd>
    </div>
  );
}

export function ProviderIdentityCard({
  summary,
  badges,
  meta,
  compact = false,
  onPhotoClick,
  onPhotoDownload,
  photoUploading = false,
  photoDownloading = false,
}: {
  summary: ProviderIdentitySummary;
  badges?: ReactNode;
  meta?: ReactNode;
  compact?: boolean;
  onPhotoClick?: () => void;
  onPhotoDownload?: () => void;
  photoUploading?: boolean;
  photoDownloading?: boolean;
}) {
  const photoSize = compact ? 56 : 88;
  const profilePhotoUrl = summary.profilePhoto ? resolveMediaUrl(summary.profilePhoto) : null;
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  return (
    <div className="card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center sm:items-start">
          {/* Provider profile photo */}
          <div className={`relative overflow-hidden rounded-full ${compact ? 'h-14 w-14' : 'h-[88px] w-[88px]'}`}>
            <SafeImage
              src={summary.profilePhoto || DEFAULT_AVATAR}
              alt=""
              fallbackSrc={DEFAULT_AVATAR}
              width={photoSize}
              height={photoSize}
              className={`rounded-full object-cover ${compact ? 'h-14 w-14' : 'h-[88px] w-[88px]'}`}
            />
            {profilePhotoUrl ? (
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                aria-label="View provider profile photo"
                className="absolute inset-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
            ) : null}
            {profilePhotoUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  title="View photo"
                  aria-label="View provider profile photo"
                  className="absolute bottom-3.5 left-3.5 z-10 rounded-full border border-white/70 bg-secondary-900/85 p-1.5 text-white transition hover:bg-primary focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                </button>
                {onPhotoDownload ? (
                  <button
                    type="button"
                    onClick={onPhotoDownload}
                    disabled={photoDownloading}
                    title="Download photo"
                    aria-label="Download provider profile photo"
                    className="absolute bottom-3.5 right-3.5 z-10 rounded-full border border-white/70 bg-secondary-900/85 p-1.5 text-white transition hover:bg-primary focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {/* Keep replacement separate from view/download actions used for ID cards. */}
          {onPhotoClick ? (
            <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
              <button
                type="button"
                onClick={onPhotoClick}
                disabled={photoUploading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-secondary-700 shadow-sm transition hover:border-primary hover:text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {photoUploading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-secondary-700" />
                ) : (
                  <CameraIcon className="h-3.5 w-3.5" />
                )}
                {photoUploading ? 'Uploading…' : profilePhotoUrl ? 'Update' : 'Add Photo'}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-center text-xs font-medium uppercase tracking-wide text-neutral-300 sm:text-left">
              Profile photo
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-secondary-900">{summary.name}</h2>
              {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
            </div>
            {meta ? <div className="text-right text-sm text-neutral-300">{meta}</div> : null}
          </div>

          <dl className="mt-5 space-y-2.5">
            <IdentityRow label="Name" value={summary.name} />
            <IdentityRow label="DOB" value={summary.dateOfBirth || '—'} />
            <IdentityRow label="Address" value={summary.address || '—'} />
            <IdentityRow
              label="Driver license #"
              value={summary.driversLicenseNumber || '—'}
            />
            <IdentityRow
              label="License issued"
              value={summary.driversLicenseIssuedDate || '—'}
            />
            <IdentityRow
              label="License expires"
              value={summary.driversLicenseExpirationDate || '—'}
            />
            <IdentityRow label="Social Security#" value={summary.socialSecurityNumber || '—'} />
            <IdentityRow label="Email" value={summary.email} />
            <IdentityRow label="Phone number" value={summary.phone || '—'} />
          </dl>
        </div>
      </div>
      <Modal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        title="Provider Profile Photo"
        size="lg"
      >
        {profilePhotoUrl ? (
          <div className="space-y-4">
            <div className="flex max-h-[65vh] items-center justify-center overflow-hidden rounded-lg bg-neutral-50 p-3">
              <SafeImage
                src={profilePhotoUrl}
                alt={`${summary.name} profile photo`}
                width={900}
                height={900}
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
            </div>
            {onPhotoDownload ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onPhotoDownload}
                  disabled={photoDownloading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {photoDownloading ? 'Preparing JPEG...' : 'Download JPEG'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
