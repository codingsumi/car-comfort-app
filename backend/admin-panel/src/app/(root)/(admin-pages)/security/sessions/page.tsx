'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge, Button, ConfirmModal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { securityService } from '@/services/security.service';
import { SecurityNav } from '@/components/security/SecurityNav';
import { truncateDevice } from '@/components/security/formatters';
import type { AdminSessionRow } from '@/types/security';
import toast from 'react-hot-toast';

type PendingAction = { id: number; kind: 'revoke' | 'forceLogout' };

export default function SecuritySessionsPage() {
  const queryClient = useQueryClient();
  const { page, queryParams, setPage } = useTableState();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['security-sessions', queryParams, page],
    queryFn: () => securityService.listSessions({ ...queryParams, page }).then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => securityService.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: ['security-sessions'] });
    },
    onError: () => toast.error('Failed to revoke session'),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (id: number) => securityService.forceLogoutSession(id),
    onSuccess: () => {
      toast.success('Force logout completed');
      queryClient.invalidateQueries({ queryKey: ['security-sessions'] });
    },
    onError: () => toast.error('Force logout failed'),
  });

  const handleConfirm = () => {
    if (!pending) return;
    if (pending.kind === 'revoke') revokeMutation.mutate(pending.id);
    else forceLogoutMutation.mutate(pending.id);
    setPending(null);
  };

  const cols: TableColumn<AdminSessionRow>[] = [
    { key: 'admin', label: 'Admin', render: (_, r) => r.admin?.name || '—' },
    { key: 'ip_address', label: 'IP', render: (_, r) => r.ip_address || '—' },
    { key: 'device_info', label: 'Device', render: (_, r) => truncateDevice(r.device_info) },
    { key: 'login_at', label: 'Login', render: (_, r) => new Date(r.login_at).toLocaleString() },
    { key: 'last_activity_at', label: 'Last activity', render: (_, r) => new Date(r.last_activity_at).toLocaleString() },
    {
      key: 'status',
      label: 'Status',
      render: (_, r) => (
        <Badge variant={r.is_revoked ? 'neutral' : 'success'}>{r.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, r) =>
        r.is_revoked ? (
          '—'
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={revokeMutation.isPending}
              onClick={(e) => { e.stopPropagation(); setPending({ id: r.id, kind: 'revoke' }); }}
            >
              Revoke
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={forceLogoutMutation.isPending}
              onClick={(e) => { e.stopPropagation(); setPending({ id: r.id, kind: 'forceLogout' }); }}
            >
              Force logout
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin Sessions"
        description="Monitor and manage active admin sessions"
      />
      <SecurityNav />
      <div className="card p-0">
        <Table columns={cols} data={data?.sessions || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        title={pending?.kind === 'forceLogout' ? 'Force logout' : 'Revoke session'}
        message={
          pending?.kind === 'forceLogout'
            ? 'Force logout will invalidate all sessions for this admin. Continue?'
            : 'Revoke this session? The admin will be signed out immediately.'
        }
        confirmLabel={pending?.kind === 'forceLogout' ? 'Force logout' : 'Revoke'}
        variant="danger"
        loading={revokeMutation.isPending || forceLogoutMutation.isPending}
      />
    </>
  );
}
