'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { supportService } from '@/services/support.service';
import { usersService } from '@/services/users.service';
import { SupportNav } from '@/components/support/SupportNav';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@/types/support';
import type { SupportTicketRow } from '@/types/support';
import { formatCategoryLabel, priorityVariant, statusVariant } from '@/components/support/formatters';

export default function SupportTicketsPage() {
  const router = useRouter();

  const { page, pageSize, search, filters, queryParams, setPage, handleSearch, handleFilter } =
    useTableState({
      defaultSortKey: 'created_at',
      defaultSortDirection: 'desc',
    });

  const params = {
    ...queryParams,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    user_type: filters.user_type || undefined,
    category: filters.category || undefined,
    assigned_to: filters.assigned_to || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', params, page],
    queryFn: () => supportService.listTickets({ ...params, page }).then((r) => r.data.data),
  });

  const { data: admins } = useQuery({
    queryKey: ['admin-users-assign'],
    queryFn: () =>
      usersService.list({ type: 'admin', limit: 100 }).then((r) => r.data.data?.users || []),
  });

  const cols: TableColumn<SupportTicketRow>[] = [
    {
      key: 'ticket_number',
      label: 'Ticket ID',
      render: (_, r) => (
        <span className="font-medium text-secondary-800">{r.ticket_number}</span>
      ),
    },
    { key: 'user_type', label: 'User type', render: (_, r) => r.user_type },
    { key: 'requester', label: 'User', render: (_, r) => r.requester?.name || '—' },
    { key: 'subject', label: 'Subject' },
    {
      key: 'category',
      label: 'Category',
      render: (_, r) => formatCategoryLabel((r as SupportTicketRow & { category?: string }).category || 'general'),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (_, r) => <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, r) => <Badge variant={statusVariant(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'assignee',
      label: 'Assigned',
      render: (_, r) => (r as SupportTicketRow & { assignee?: { name: string } }).assignee?.name || '—',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (_, r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: 'last_message_at',
      label: 'Last response',
      render: (_, r) => (r.last_message_at ? new Date(r.last_message_at).toLocaleString() : '—'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Support tickets"
        description="Click a ticket to view details, live chat, and admin actions"
      />
      <SupportNav />

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Ticket ID, name, email, subject..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Any', value: '' },
                ...TICKET_STATUSES.map((s) => ({ label: s.replace(/_/g, ' '), value: s })),
              ],
            },
            {
              key: 'priority',
              label: 'Priority',
              value: filters.priority || '',
              onChange: (v) => handleFilter('priority', v),
              options: [{ label: 'Any', value: '' }, ...TICKET_PRIORITIES.map((p) => ({ label: p, value: p }))],
            },
            {
              key: 'user_type',
              label: 'User type',
              value: filters.user_type || '',
              onChange: (v) => handleFilter('user_type', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Customer', value: 'customer' },
                { label: 'Service Provider', value: 'driver' },
                { label: 'Garage', value: 'garage' },
              ],
            },
            {
              key: 'category',
              label: 'Category',
              value: filters.category || '',
              onChange: (v) => handleFilter('category', v),
              options: [
                { label: 'Any', value: '' },
                ...TICKET_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
              ],
            },
            {
              key: 'assigned_to',
              label: 'Assigned admin',
              value: filters.assigned_to || '',
              onChange: (v) => handleFilter('assigned_to', v),
              options: [
                { label: 'Any', value: '' },
                ...(admins || []).map((a) => ({ label: a.name || `Admin #${a.id}`, value: String(a.id) })),
              ],
            },
          ]}
        />

        <Table
          columns={cols}
          data={data?.tickets || []}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/support/tickets/${r.id}`)}
          emptyMessage="No support tickets found"
        />

        <Pagination
          currentPage={page}
          totalPages={data?.pagination.total_pages ?? 1}
          onPageChange={setPage}
          totalItems={data?.pagination.total}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
