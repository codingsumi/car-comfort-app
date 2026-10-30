'use client';

import { useRef, useState } from 'react';
import { ArrowUpTrayIcon, DocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import { legalPagesService } from '@/services/legalPages.service';
import { resolveMediaUrl } from '@/lib/paths';
import toast from 'react-hot-toast';

const MAX_PDF_BYTES = 15 * 1024 * 1024;

interface LegalBackgroundCheckPdfUploadProps {
  pdfUrl: string;
  onPdfUrlChange: (url: string) => void;
  onClearError?: () => void;
  error?: string;
  disabled?: boolean;
}

export function LegalBackgroundCheckPdfUpload({
  pdfUrl,
  onPdfUrlChange,
  onClearError,
  error,
  disabled,
}: LegalBackgroundCheckPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error('PDF must be 15 MB or smaller');
      return;
    }

    setUploading(true);
    try {
      const { url, filename } = await legalPagesService.uploadPdf(file);
      onPdfUrlChange(url);
      setFileName(filename || file.name);
      onClearError?.();
      toast.success('PDF uploaded');
    } catch {
      toast.error('Failed to upload PDF');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    onPdfUrlChange('');
    setFileName('');
  };

  const displayName =
    fileName || (pdfUrl ? pdfUrl.split('/').pop() || 'background-check.pdf' : '');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-secondary-500">
        Background check form (PDF) <span className="text-danger-500">*</span>
      </label>
      <p className="text-xs text-neutral-400">
        Providers download this blank form during onboarding step 5. No HTML content is used for
        this page.
      </p>

      {pdfUrl ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 ${
            error ? 'border-danger-500' : 'border-neutral-200'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
              <DocumentIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-secondary-700">{displayName}</p>
              <a
                href={resolveMediaUrl(pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Preview PDF
              </a>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-secondary-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={handleRemove}
              className="rounded-lg p-2 text-neutral-400 hover:bg-danger-50 hover:text-danger disabled:opacity-50"
              aria-label="Remove PDF"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors disabled:opacity-50 ${
            error
              ? 'border-danger-300 bg-danger-50/30 hover:border-danger-400'
              : 'border-neutral-200 bg-neutral-50/50 hover:border-primary-300 hover:bg-primary-50/30'
          }`}
        >
          <ArrowUpTrayIcon className="mb-2 h-8 w-8 text-neutral-300" />
          <span className="text-sm font-medium text-secondary-600">
            {uploading ? 'Uploading…' : 'Click to upload PDF'}
          </span>
          <span className="mt-1 text-xs text-neutral-400">PDF only, max 15 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleChange}
      />

      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  );
}
