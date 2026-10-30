'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { providersService } from '@/services/providers.service';
import type { ProviderListItem } from '@/services/providers.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { SafeImage } from '@/components/shared/SafeImage';
import { Table, Pagination, Badge, Dropdown } from '@/components/ui';
import { formatJoinedDate } from '@/utils/formatDate';
import { buildProviderIdentitySummary } from '@/utils/providerProfileSummary';
import type { TableColumn } from '@/types';
import {
  EllipsisVerticalIcon,
  EyeIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  StarIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U1RTdFQiIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOUNBM0FGIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEwIiByeD0iMzYiIHJ5PSIyOCIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

const approvalVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

export default function ProvidersListPage() {
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
    queryKey: ['admin-providers', queryParams],
    queryFn: () =>
      providersService
        .list({
          ...queryParams,
          status: filters.status,
          approval_status: filters.approval_status,
          insurance_verified: filters.insurance_verified,
        })
        .then((r) => {
          const d = r.data.data;
          return {
            rows: d.providers,
            count: d.pagination.total,
            totalPages: d.pagination.total_pages,
            currentPage: d.pagination.page,
          };
        }),
  });

  const columns: TableColumn<ProviderListItem>[] = [
    {
      key: 'name',
      label: 'Profile',
      sortable: true,
      render: (_, row) => {
        const identity = buildProviderIdentitySummary(row, row.driver_profile);
        return (
          <div className="flex min-w-[260px] items-start gap-3">
            <SafeImage
              src={identity.profilePhoto || DEFAULT_AVATAR}
              alt=""
              fallbackSrc={DEFAULT_AVATAR}
              width={40}
              height={40}
              className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-secondary-900">{identity.name}</p>
              <p className="text-xs text-neutral-400">
                <span className="font-medium text-neutral-300">DOB:</span> {identity.dateOfBirth || '—'}
              </p>
              <p className="truncate text-xs text-neutral-400" title={identity.address || undefined}>
                <span className="font-medium text-neutral-300">Address:</span> {identity.address || '—'}
              </p>
              <p className="text-xs text-neutral-400">
                <span className="font-medium text-neutral-300">SSN:</span> {identity.socialSecurityNumber || '—'}
              </p>
              <p className="text-xs text-neutral-400">{identity.email}</p>
              <p className="text-xs text-neutral-400">{identity.phone || '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'avg_rating',
      label: 'Rating',
      render: (_, row) =>
        row.avg_rating ? (
          <span className="flex items-center gap-1 text-sm">
            <StarIcon className="h-4 w-4 fill-warning text-warning" />
            <span className="font-medium text-secondary-900">{row.avg_rating}</span>
            <span className="text-neutral-300">({row.total_reviews})</span>
          </span>
        ) : (
          <span className="text-sm text-neutral-300">—</span>
        ),
    },
    {
      key: 'total_services',
      label: 'Services',
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">{row.total_services}</span>
      ),
    },
    {
      key: 'total_earnings',
      label: 'Earnings',
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">
          ${parseFloat(row.total_earnings).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'approval_status',
      label: 'Verification',
      render: (_, row) => (
        <div className="flex flex-col gap-1">
          <Badge variant={approvalVariant[row.driver_profile?.approval_status || 'pending'] || 'neutral'} dot>
            {(row.driver_profile?.approval_status || 'pending').charAt(0).toUpperCase() +
              (row.driver_profile?.approval_status || 'pending').slice(1)}
          </Badge>
          {row.driver_profile?.insurance_verified && (
            <span className="flex items-center gap-1 text-xs text-success">
              <ShieldCheckIcon className="h-3 w-3" /> Insured
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Account',
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
                onClick: () => router.push(`/providers/${row.id}`),
                icon: <EyeIcon className="h-4 w-4" />,
              },
              ...(row.driver_profile?.approval_status === 'pending'
                ? [
                    {
                      label: 'Approve',
                      onClick: () => router.push(`/providers/${row.id}`),
                      icon: <CheckCircleIcon className="h-4 w-4" />,
                    },
                  ]
                : []),
              {
                label:
                  row.status === 'deactivated'
                    ? 'Activate'
                    : row.status === 'suspended'
                      ? 'Reactivate'
                      : 'Suspend',
                onClick: () => router.push(`/providers/${row.id}`),
                icon: <NoSymbolIcon className="h-4 w-4" />,
              },
              ...(row.status !== 'deactivated'
                ? [
                    {
                      label: 'Deactivate',
                      onClick: () => router.push(`/providers/${row.id}`),
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
        title="Providers"
        description="Manage service providers, verification, and account status"
      />
      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, email, or phone..."
          filters={[
            {
              key: 'approval_status',
              label: 'All Approvals',
              value: filters.approval_status || '',
              onChange: (v) => handleFilter('approval_status', v),
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ],
            },
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
            {
              key: 'insurance_verified',
              label: 'Insurance',
              value: filters.insurance_verified || '',
              onChange: (v) => handleFilter('insurance_verified', v),
              options: [
                { label: 'Verified', value: 'true' },
                { label: 'Unverified', value: 'false' },
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
          onRowClick={(row) => router.push(`/providers/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No providers found"
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
