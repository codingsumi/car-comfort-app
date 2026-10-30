'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { securityService } from '@/services/security.service';
import { SecurityNav } from '@/components/security/SecurityNav';
import { alertStatusVariant, formatAlertType, severityVariant } from '@/components/security/formatters';
import { ALERT_STATUSES, type SecurityAlertRow } from '@/types/security';
import toast from 'react-hot-toast';

export default function SecurityMonitoringPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const initialSeverity = searchParams.get('severity') || '';

  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState();

  const params = {
    ...queryParams,
    status: filters.status || undefined,
    severity: filters.severity || initialSeverity || undefined,
    alert_type: filters.alert_type || undefined,
    search: search || undefined,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['security-alerts', params, page],
    queryFn: () => securityService.listAlerts({ ...params, page }).then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => securityService.updateAlertStatus(id, status),
    onSuccess: () => {
      toast.success('Alert updated');
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
    },
    onError: () => toast.error('Update failed'),
  });

  const cols: TableColumn<SecurityAlertRow>[] = [
    { key: 'id', label: 'ID', render: (_, r) => r.id },
    { key: 'alert_type', label: 'Type', render: (_, r) => formatAlertType(r.alert_type) },
    {
      key: 'severity',
      label: 'Severity',
      render: (_, r) => <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>,
    },
    {
      key: 'entity',
      label: 'Affected',
      render: (_, r) =>
        r.entity_type ? `${r.entity_type}${r.entity_id != null ? ` #${r.entity_id}` : ''}` : '—',
    },
    { key: 'recommended_action', label: 'Recommended', render: (_, r) => r.recommended_action || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (_, r) => <Badge variant={alertStatusVariant(r.status)}>{r.status}</Badge>,
    },
    { key: 'created_at', label: 'Detected', render: (_, r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, r) =>
        r.status !== 'resolved' ? (
          <div className="flex flex-wrap gap-1">
            {r.status === 'open' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  statusMutation.mutate({ id: r.id, status: 'investigating' });
                }}
              >
                Investigate
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                statusMutation.mutate({ id: r.id, status: 'resolved' });
              }}
            >
              Resolve
            </Button>
          </div>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Suspicious Activity"
        description="Security alerts from automated detection rules"
        actions={
          <button type="button" className="btn-outline text-sm" onClick={() => refetch()}>
            Refresh
          </button>
        }
      />
      <SecurityNav />
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Filter by alert type..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: ALERT_STATUSES.map((s) => ({ label: s, value: s })),
            },
            {
              key: 'severity',
              label: 'Severity',
              value: filters.severity || initialSeverity || '',
              onChange: (v) => handleFilter('severity', v),
              options: [
                { label: 'critical', value: 'critical' },
                { label: 'high', value: 'high' },
                { label: 'medium', value: 'medium' },
                { label: 'low', value: 'low' },
              ],
            },
          ]}
        />
      </div>
      <div className="card p-0">
        <Table columns={cols} data={data?.alerts || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>
    </>
  );
}
