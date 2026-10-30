'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { usersService } from '@/services/users.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge } from '@/components/ui';
import { formatJoinedDate } from '@/utils/formatDate';
import type { User, TableColumn } from '@/types';

export default function CustomersPage() {
  const router = useRouter();
  const { page, pageSize, search, sortKey, sortDirection, queryParams, setPage, handleSort, handleSearch } =
    useTableState();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () =>
      usersService.list({ ...queryParams, role: 'customer' }).then((r) => {
        const d = r.data.data;
        return {
          rows: d.users,
          count: d.pagination.total,
          totalPages: d.pagination.total_pages,
          currentPage: d.pagination.page,
        };
      }),
  });

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary">
            <span className="text-xs font-bold">{(row.name?.[0] || row.email[0]).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-medium text-secondary-900">{row.name || '—'}</p>
            <p className="text-xs text-neutral-300">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (_, row) => row.phone || '—' },
    {
      key: 'is_verified',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={row.is_verified ? 'success' : 'warning'} dot>
          {row.is_verified ? 'Verified' : 'Unverified'}
        </Badge>
      ),
    },
    { key: 'referral_code', label: 'Referral', render: (_, row) => row.referral_code || '—' },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: (_, row) => formatJoinedDate(row),
    },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Manage platform customers" />
      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, phone..."
        />
        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => router.push(`/users/customers/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No customers found"
          rowKey={(row) => row.id}
        />
        <Pagination
          currentPage={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          totalItems={data?.count}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
