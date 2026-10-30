'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/cn';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/shared/SafeImage';

interface ImageUploadProps {
  label?: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<string>;
  accept?: string;
  maxSize?: number;
}

export function ImageUpload({
  label,
  description,
  value,
  onChange,
  onUpload,
  accept = 'image/jpeg,image/png,image/svg+xml,image/webp,image/x-icon',
  maxSize = 5 * 1024 * 1024,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > maxSize) {
      setError(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    setUploading(true);
    try {
      const url = await onUpload(file);
      onChange(url);
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {label && <p className="mb-1.5 text-sm font-medium text-secondary-500">{label}</p>}
      {description && <p className="mb-2 text-xs text-neutral-300">{description}</p>}

      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative">
            <SafeImage
              src={value}
              alt={label || 'Upload'}
              width={64}
              height={64}
              className="h-16 w-16 rounded-lg border border-neutral-100 object-contain p-1"
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-danger p-0.5 text-white shadow-sm hover:bg-danger-600"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50">
            <PhotoIcon className="h-6 w-6 text-neutral-200" />
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-secondary-500 transition-colors hover:bg-neutral-50',
              uploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {uploading ? 'Uploading...' : value ? 'Change' : 'Upload'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  );
}
