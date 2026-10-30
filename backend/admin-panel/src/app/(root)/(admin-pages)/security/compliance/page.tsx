'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, ConfirmModal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { securityService } from '@/services/security.service';
import { SecurityNav } from '@/components/security/SecurityNav';
import { complianceStatusVariant } from '@/components/security/formatters';
import {
  COMPLIANCE_STATUSES,
  COMPLIANCE_TYPES,
  DELETION_TYPES,
  type ComplianceRequestRow,
  type DeletionType,
} from '@/types/security';
import toast from 'react-hot-toast';

export default function SecurityCompliancePage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ user_id: '', request_type: 'account_deletion', deletion_type: 'soft_delete' as DeletionType, notes: '' });
  const [verifyTarget, setVerifyTarget] = useState<number | null>(null);
  const [completeTarget, setCompleteTarget] = useState<{ id: number; deletionType: string } | null>(null);

  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState();

  const params = {
    ...queryParams,
    request_type: filters.request_type || undefined,
    request_status: filters.request_status || undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['security-compliance', params, page],
    queryFn: () => securityService.listCompliance({ ...params, page }).then((r) => r.data.data),
  });

  const processMutation = useMutation({
    mutationFn: ({ id, action, deletion_type }: { id: number; action: string; deletion_type?: string }) =>
      securityService.processCompliance(id, { action, deletion_type }),
    onSuccess: () => {
      toast.success('Request updated');
      queryClient.invalidateQueries({ queryKey: ['security-compliance'] });
    },
    onError: () => toast.error('Action failed'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      securityService.createComplianceRequest({
        user_id: Number(createForm.user_id),
        request_type: createForm.request_type,
        deletion_type: createForm.deletion_type,
        notes: createForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Compliance request created');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['security-compliance'] });
    },
    onError: () => toast.error('Failed to create request'),
  });

  const exportMutation = useMutation({
    mutationFn: (userId: number) => securityService.exportUserData(userId),
    onSuccess: (res) => {
      toast.success('Export generated');
      if (res.data.data?.export_url) window.open(res.data.data.export_url, '_blank');
      queryClient.invalidateQueries({ queryKey: ['security-compliance'] });
    },
    onError: () => toast.error('Export failed'),
  });

  const cols: TableColumn<ComplianceRequestRow>[] = [
    { key: 'id', label: 'ID', render: (_, r) => r.id },
    { key: 'user', label: 'User', render: (_, r) => r.user?.name || `User #${r.user_id}` },
    { key: 'request_type', label: 'Type', render: (_, r) => r.request_type.replace(/_/g, ' ') },
    {
      key: 'request_status',
      label: 'Status',
      render: (_, r) => <Badge variant={complianceStatusVariant(r.request_status)}>{r.request_status}</Badge>,
    },
    { key: 'deletion_type', label: 'Deletion', render: (_, r) => r.deletion_type?.replace(/_/g, ' ') || '—' },
    { key: 'created_at', label: 'Requested', render: (_, r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, r) => (
        <div className="flex flex-wrap gap-1">
          {r.request_status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setVerifyTarget(r.id); }}
            >
              Verify
            </Button>
          )}
          {r.user_id && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                exportMutation.mutate(r.user_id);
              }}
            >
              Export
            </Button>
          )}
          {r.export_url && (
            <a href={r.export_url} target="_blank" rel="noreferrer" className="btn-outline px-2 py-1 text-xs">
              Download
            </a>
          )}
          {['pending', 'verified'].includes(r.request_status) && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); setCompleteTarget({ id: r.id, deletionType: r.deletion_type || 'soft_delete' }); }}
            >
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Compliance Requests"
        description="Privacy compliance — account deletions, data exports, and anonymization"
        actions={
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            New request
          </Button>
        }
      />
      <SecurityNav />

      {showCreate && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-medium text-secondary-900">Create compliance request</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              User ID
              <input
                className="input mt-1 w-full"
                value={createForm.user_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, user_id: e.target.value }))}
                placeholder="User ID"
              />
            </label>
            <label className="text-sm">
              Request type
              <select
                className="input mt-1 w-full"
                value={createForm.request_type}
                onChange={(e) => setCreateForm((f) => ({ ...f, request_type: e.target.value }))}
              >
                {COMPLIANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Deletion type
              <select
                className="input mt-1 w-full"
                value={createForm.deletion_type}
                onChange={(e) => setCreateForm((f) => ({ ...f, deletion_type: e.target.value as DeletionType }))}
              >
                {DELETION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Notes
              <textarea
                className="input mt-1 w-full"
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!createForm.user_id || createMutation.isPending}>
            Submit
          </Button>
        </div>
      )}

      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search user name or email..."
          filters={[
            {
              key: 'request_type',
              label: 'Type',
              value: filters.request_type || '',
              onChange: (v) => handleFilter('request_type', v),
              options: COMPLIANCE_TYPES.map((t) => ({ label: t.replace(/_/g, ' '), value: t })),
            },
            {
              key: 'request_status',
              label: 'Status',
              value: filters.request_status || '',
              onChange: (v) => handleFilter('request_status', v),
              options: COMPLIANCE_STATUSES.map((s) => ({ label: s, value: s })),
            },
          ]}
        />
      </div>

      <div className="card p-0">
        <Table columns={cols} data={data?.requests || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmModal
        open={verifyTarget !== null}
        onClose={() => setVerifyTarget(null)}
        onConfirm={() => { if (verifyTarget !== null) { processMutation.mutate({ id: verifyTarget, action: 'verify' }); setVerifyTarget(null); } }}
        title="Verify deletion request"
        message="Mark this request as verified and ready to process?"
        confirmLabel="Verify"
        variant="warning"
        loading={processMutation.isPending}
      />

      <ConfirmModal
        open={completeTarget !== null}
        onClose={() => setCompleteTarget(null)}
        onConfirm={() => { if (completeTarget) { processMutation.mutate({ id: completeTarget.id, action: 'complete', deletion_type: completeTarget.deletionType }); setCompleteTarget(null); } }}
        title="Complete deletion request"
        message={completeTarget ? `Complete with ${completeTarget.deletionType}? This may deactivate or permanently delete user data.` : ''}
        confirmLabel="Complete"
        variant="danger"
        loading={processMutation.isPending}
      />
    </>
  );
}
