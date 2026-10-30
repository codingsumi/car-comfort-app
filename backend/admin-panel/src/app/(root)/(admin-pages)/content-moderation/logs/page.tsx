'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import type { ModerationLogRow } from '@/types/contentModeration';

export default function ModerationLogsPage() {
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const params = {
    ...queryParams,
    entity_type: filters.entity_type || undefined,
    moderation_only: filters.moderation_only || 'true',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['moderation-logs', params, page],
    queryFn: () => contentModerationService.listModerationLogs({ ...params, page }).then((r) => r.data.data),
  });

  const cols: TableColumn<ModerationLogRow>[] = [
    { key: 'created_at', label: 'Timestamp', render: (_, r) => new Date(r.created_at).toLocaleString() },
    { key: 'moderator', label: 'Admin', render: (_, r) => r.moderator?.name || r.admin?.name || '—' },
    { key: 'action_type', label: 'Action' },
    { key: 'target_entity', label: 'Target' },
    { key: 'previous_status', label: 'Prev', render: (_, r) => r.previous_status || '—' },
    { key: 'new_status', label: 'New', render: (_, r) => r.new_status || '—' },
    { key: 'ip_address', label: 'IP' },
  ];

  return (
    <>
      <PageHeader title="Moderation logs" description="Immutable audit trail for review, report, ticket, and FAQ changes." />
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search action type..."
          filters={[
            {
              key: 'entity_type',
              label: 'Entity',
              value: filters.entity_type || '',
              onChange: (v) => handleFilter('entity_type', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Review', value: 'review' },
                { label: 'Report', value: 'platform_report' },
                { label: 'Ticket', value: 'support_ticket' },
                { label: 'FAQ', value: 'faq' },
                { label: 'User', value: 'user' },
              ],
            },
            {
              key: 'moderation_only',
              label: 'Scope',
              value: filters.moderation_only ?? 'true',
              onChange: (v) => handleFilter('moderation_only', v),
              options: [
                { label: 'Moderation only', value: 'true' },
                { label: 'All admin audit', value: 'false' },
              ],
            },
          ]}
        />
      </div>
      <div className="card p-0">
        <Table columns={cols} data={data?.logs || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>
    </>
  );
}
