'use client';

import { useRef, useState } from 'react';
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  LEGAL_IMPORT_ACCEPT,
  formatImportFileLabel,
  importLegalDocument,
  mergeImportedHtml,
  type LegalImportMode,
} from '@/utils/legalDocumentImport';

interface LegalDocumentImportProps {
  htmlContent: string;
  onContentChange: (html: string) => void;
  onClearContentError?: () => void;
}

export function LegalDocumentImport({
  htmlContent,
  onContentChange,
  onClearContentError,
}: LegalDocumentImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<LegalImportMode>('replace');
  const [lastFileLabel, setLastFileLabel] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handlePickFile = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const hasExisting = htmlContent.trim().length > 0;
    const mode = importMode;

    if (hasExisting && mode === 'replace') {
      setPendingFile(file);
      return;
    }

    setImporting(true);
    try {
      const imported = await importLegalDocument(file);
      const merged = mergeImportedHtml(htmlContent, imported, mode);
      onContentChange(merged);
      onClearContentError?.();
      setLastFileLabel(formatImportFileLabel(file));
      toast.success(
        mode === 'append'
          ? 'Document appended to page content'
          : 'Document imported into page content'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import document';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
            <DocumentTextIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary-900">Import from document</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Upload Word (.docx), HTML, or plain text. Content is converted to HTML for the mobile
              app.
            </p>
            {lastFileLabel && (
              <p className="mt-1 text-xs text-primary-700">Last import: {lastFileLabel}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                importMode === 'replace'
                  ? 'bg-primary text-white'
                  : 'text-neutral-500 hover:text-secondary-700'
              }`}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setImportMode('append')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                importMode === 'append'
                  ? 'bg-primary text-white'
                  : 'text-neutral-500 hover:text-secondary-700'
              }`}
            >
              Append
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={importing}
            onClick={handlePickFile}
            icon={<ArrowUpTrayIcon className="h-4 w-4" />}
          >
            Choose file
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LEGAL_IMPORT_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmModal
        open={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        onConfirm={async () => {
          const file = pendingFile;
          setPendingFile(null);
          if (!file) return;
          setImporting(true);
          try {
            const imported = await importLegalDocument(file);
            const merged = mergeImportedHtml(htmlContent, imported, importMode);
            onContentChange(merged);
            onClearContentError?.();
            setLastFileLabel(formatImportFileLabel(file));
            toast.success('Document imported into page content');
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not import document';
            toast.error(message);
          } finally {
            setImporting(false);
          }
        }}
        title="Replace content?"
        message="Import will replace the current HTML content in the editor. This cannot be undone."
        confirmLabel="Replace"
        variant="warning"
      />
    </div>
  );
}
