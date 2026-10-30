'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { securityService } from '@/services/security.service';
import { SecurityNav } from '@/components/security/SecurityNav';
import { formatActionLabel, severityVariant, truncateDevice } from '@/components/security/formatters';
import { AUDIT_SEVERITIES, MODULE_OPTIONS, type ActivityLogRow } from '@/types/security';
import toast from 'react-hot-toast';

export default function SecurityLogsPage() {
  const router = useRouter();
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const params = {
    ...queryParams,
    action_type: filters.action_type || undefined,
    severity: filters.severity || undefined,
    module: filters.module || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    ip_address: filters.ip_address || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['security-logs', params, page],
    queryFn: () => securityService.listLogs({ ...params, page }).then((r) => r.data.data),
  });

  const handleExport = async () => {
    try {
      const res = await securityService.exportLogsCsv(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const cols: TableColumn<ActivityLogRow>[] = [
    { key: 'id', label: 'ID', render: (_, r) => r.id },
    { key: 'admin', label: 'Admin', render: (_, r) => r.admin?.name || '—' },
    { key: 'action_type', label: 'Action', render: (_, r) => formatActionLabel(r.action_type) },
    {
      key: 'entity',
      label: 'Entity',
      render: (_, r) => `${r.entity_type}${r.entity_id != null ? ` #${r.entity_id}` : ''}`,
    },
    { key: 'module', label: 'Module', render: (_, r) => r.module || '—' },
    { key: 'ip_address', label: 'IP', render: (_, r) => r.ip_address || '—' },
    { key: 'device_info', label: 'Device', render: (_, r) => truncateDevice(r.device_info) },
    { key: 'created_at', label: 'Timestamp', render: (_, r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'severity',
      label: 'Severity',
      render: (_, r) => <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="Comprehensive audit trail of admin actions across all modules"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export CSV
          </Button>
        }
      />
      <SecurityNav />
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search action, entity, module..."
          filters={[
            {
              key: 'action_type',
              label: 'Action',
              value: filters.action_type || '',
              onChange: (v) => handleFilter('action_type', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Login', value: 'admin_login' },
                { label: 'Logout', value: 'admin_logout' },
                { label: 'Password reset', value: 'password' },
                { label: 'Refund', value: 'refund' },
                { label: 'Export', value: 'export' },
                { label: 'Deletion', value: 'deletion' },
              ],
            },
            {
              key: 'severity',
              label: 'Severity',
              value: filters.severity || '',
              onChange: (v) => handleFilter('severity', v),
              options: [{ label: 'Any', value: '' }, ...AUDIT_SEVERITIES.map((s) => ({ label: s, value: s }))],
            },
            {
              key: 'module',
              label: 'Module',
              value: filters.module || '',
              onChange: (v) => handleFilter('module', v),
              options: [{ label: 'Any', value: '' }, ...MODULE_OPTIONS.map((m) => ({ label: m, value: m }))],
            },
          ]}
        />
      </div>
      <div className="card p-0">
        <Table
          columns={cols}
          data={data?.logs || []}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/security/logs/${r.id}`)}
        />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>
    </>
  );
}
