'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { customersService } from '@/services/customers.service';
import type { CustomerListItem } from '@/services/customers.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, Dropdown } from '@/components/ui';
import { formatJoinedDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import {
  EllipsisVerticalIcon,
  EyeIcon,
  NoSymbolIcon,
  TrashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

export default function CustomersListPage() {
  const router = useRouter();
  const {
    page,
    pageSize,
    search,
    sortKey,
    sortDirection,
    filters,
    queryParams,
    setPage,
    handleSort,
    handleSearch,
    handleFilter,
  } = useTableState();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', queryParams],
    queryFn: () =>
      customersService.list({ ...queryParams, status: filters.status }).then((r) => {
        const d = r.data.data;
        return {
          rows: d.customers,
          count: d.pagination.total,
          totalPages: d.pagination.total_pages,
          currentPage: d.pagination.page,
        };
      }),
  });

  const columns: TableColumn<CustomerListItem>[] = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary">
            <span className="text-xs font-bold">
              {(row.name?.[0] || row.email[0]).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-secondary-900">
              {row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—'}
            </p>
            <p className="text-xs text-neutral-300">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (_, row) => (
        <span className="text-sm text-secondary-500">
          {row.phone ? `${row.country_code || ''} ${row.phone}` : '—'}
        </span>
      ),
    },
    {
      key: 'total_bookings',
      label: 'Bookings',
      sortable: false,
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">{row.total_bookings}</span>
      ),
    },
    {
      key: 'total_spent',
      label: 'Total Spent',
      sortable: false,
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">
          ${parseFloat(row.total_spent).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm text-neutral-300">{formatJoinedDate(row)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className="rounded p-1 hover:bg-neutral-100">
                <EllipsisVerticalIcon className="h-5 w-5 text-neutral-300" />
              </button>
            }
            items={[
              {
                label: 'View Details',
                onClick: () => router.push(`/customers/${row.id}`),
                icon: <EyeIcon className="h-4 w-4" />,
              },
              {
                label:
                  row.status === 'deactivated'
                    ? 'Activate'
                    : row.status === 'suspended'
                      ? 'Reactivate'
                      : 'Suspend',
                onClick: () => router.push(`/customers/${row.id}`),
                icon: <NoSymbolIcon className="h-4 w-4" />,
              },
              {
                label: 'Reset Password',
                onClick: () => router.push(`/customers/${row.id}`),
                icon: <KeyIcon className="h-4 w-4" />,
              },
              ...(row.status !== 'deactivated'
                ? [
                    {
                      label: 'Deactivate',
                      onClick: () => router.push(`/customers/${row.id}`),
                      icon: <TrashIcon className="h-4 w-4" />,
                      danger: true,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage platform customers, view details, and take account actions"
      />
      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, or phone..."
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Deactivated', value: 'deactivated' },
              ],
            },
          ]}
        />
        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
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
