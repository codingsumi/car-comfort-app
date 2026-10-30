'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { settingsService } from '@/services/settings.service';
import { Pagination, Button, ConfirmModal } from '@/components/ui';
import type { AuditLogEntry, AuditLogsResponse } from '@/types/settings';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export function AuditLogViewer() {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await settingsService.getAuditLogs({ page, limit: 15 });
      setData(result);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalLogs = data?.pagination.total ?? 0;
  const hasLogs = totalLogs > 0;

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      const result = await settingsService.deleteAllAuditLogs();
      toast.success(
        result.deleted
          ? `Deleted ${result.deleted} log${result.deleted === 1 ? '' : 's'}`
          : 'No logs to delete'
      );
      setDeleteOpen(false);
      setPage(1);
      const fresh = await settingsService.getAuditLogs({ page: 1, limit: 15 });
      setData(fresh);
    } catch {
      toast.error('Failed to delete audit logs');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded bg-neutral-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-400">
          {hasLogs
            ? `${totalLogs} entr${totalLogs === 1 ? 'y' : 'ies'}`
            : 'No audit history'}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasLogs || deleting}
          onClick={() => setDeleteOpen(true)}
          className="text-danger border-danger/30 hover:bg-danger-50"
        >
          <TrashIcon className="mr-1.5 h-4 w-4" />
          Delete all logs
        </Button>
      </div>

      {!data || data.logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-300">
          No audit logs yet. Changes to settings will appear here.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.logs.map((log: AuditLogEntry) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary">
                  {log.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-secondary-900">
                    <span className="font-medium">{log.user?.name || 'Admin'}</span>
                    {' updated '}
                    <span className="font-mono text-xs rounded bg-neutral-50 px-1.5 py-0.5">
                      {log.setting_key}
                    </span>
                    {' in '}
                    <span className="font-medium">{log.group_name}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-300">
                    <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                    {log.ip_address && <span>{log.ip_address}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.pagination.total_pages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={data.pagination.total_pages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmModal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={() => void handleDeleteAll()}
        title="Delete all audit logs?"
        message={`This permanently removes all ${totalLogs} settings audit log entr${totalLogs === 1 ? 'y' : 'ies'}. This cannot be undone.`}
        confirmLabel="Delete all"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
