'use client';

import { resolveMediaUrl } from '@/lib/paths';

interface NotificationPreviewProps {
  title: string;
  message: string;
  imageUrl?: string;
  ctaText?: string;
}

export function NotificationPreview({ title, message, imageUrl, ctaText }: NotificationPreviewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PreviewCard label="Mobile push">
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white">
              CC
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-semibold text-secondary-900">{title || 'Title'}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{message || 'Message preview'}</p>
            </div>
          </div>
        </div>
      </PreviewCard>

      <PreviewCard label="Email">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(imageUrl)} alt="" className="h-24 w-full object-cover" />
          ) : null}
          <div className="p-4">
            <p className="text-sm font-semibold text-secondary-900">{title || 'Email subject'}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-500">{message || 'Email body'}</p>
            {ctaText ? (
              <span className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-xs font-medium text-white">
                {ctaText}
              </span>
            ) : null}
          </div>
        </div>
      </PreviewCard>

      <PreviewCard label="In-app">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-start gap-3 rounded-lg bg-white p-3 shadow-sm">
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-medium text-secondary-900">{title || 'In-app title'}</p>
              <p className="mt-1 text-xs text-neutral-500">{message || 'In-app message'}</p>
            </div>
          </div>
        </div>
      </PreviewCard>
    </div>
  );
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      {children}
    </div>
  );
}
