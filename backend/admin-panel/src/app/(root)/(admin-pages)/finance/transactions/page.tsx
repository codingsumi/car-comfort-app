'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { financeService } from '@/services/finance.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, StatsCard, Button, Input } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import type { Transaction, TransactionType, TransactionStatus } from '@/types/finance';
import {
  BanknotesIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ReceiptPercentIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatCurrency';

const statusVariant: Record<TransactionStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  succeeded: 'success',
  processing: 'primary',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

const typeLabel: Record<TransactionType, string> = {
  booking_payment: 'Payment',
  refund: 'Refund',
  partial_refund: 'Partial Refund',
  provider_payout: 'Payout',
  adjustment: 'Adjustment',
  manual_payout: 'Manual Payout',
  commission_deduction: 'Commission',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  const {
    page, pageSize, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  const { data, isLoading } = useQuery({
    queryKey: ['finance-transactions', queryParams, filters, dateFrom, dateTo, amountMin, amountMax],
    queryFn: () =>
      financeService.listTransactions({
        ...queryParams,
        status: filters.status || undefined,
        transaction_type: filters.transaction_type || undefined,
        payment_method: filters.payment_method || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        amount_min: amountMin ? parseFloat(amountMin) : undefined,
        amount_max: amountMax ? parseFloat(amountMax) : undefined,
      }).then((r) => r.data.data),
  });

  const handleExportCsv = useCallback(async () => {
    try {
      const response = await financeService.exportTransactionsCsv({
        status: filters.status || undefined,
        transaction_type: filters.transaction_type || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // error handled by axios interceptor
    }
  }, [filters, dateFrom, dateTo]);

  const stats = data?.stats;

  const columns: TableColumn<Transaction>[] = [
    {
      key: 'transaction_code',
      label: 'Transaction ID',
      sortable: false,
      render: (_, row) => (
        <span className="font-mono text-xs font-medium text-secondary-900">{row.transaction_code}</span>
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      render: (_, row) =>
        row.booking ? (
          <span className="font-mono text-xs text-primary">{row.booking.booking_code}</span>
        ) : (
          <span className="text-xs text-neutral-200">—</span>
        ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{row.customer?.name || '—'}</span>
      ),
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{row.provider?.name || '—'}</span>
      ),
    },
    {
      key: 'transaction_type',
      label: 'Type',
      render: (_, row) => (
        <Badge variant="neutral">{typeLabel[row.transaction_type] || row.transaction_type}</Badge>
      ),
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (_, row) => (
        <span className="text-xs text-neutral-300 capitalize">{row.payment_method || '—'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-semibold text-secondary-900">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'commission_amount',
      label: 'Commission',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{formatCurrency(row.commission_amount)}</span>
      ),
    },
    {
      key: 'provider_earning',
      label: 'Provider Earning',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{formatCurrency(row.provider_earning)}</span>
      ),
    },
    {
      key: 'tax_amount',
      label: 'Tax',
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatCurrency(row.tax_amount)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatDate(row.created_at, 'MMM d, yyyy')}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Transactions"
        description="View and manage all financial transactions"
        actions={
          <Button variant="outline" size="sm" icon={<ArrowDownTrayIcon className="h-4 w-4" />} onClick={handleExportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Total Transactions"
          value={stats?.total_count ?? 0}
          icon={<BanknotesIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats?.total_revenue ?? 0)}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Refunds"
          value={formatCurrency(stats?.total_refunds ?? 0)}
          icon={<ArrowPathIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Net Revenue"
          value={formatCurrency(stats?.net_revenue ?? 0)}
          icon={<ReceiptPercentIcon className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by transaction ID, booking ID, customer, provider..."
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Processing', value: 'processing' },
                { label: 'Succeeded', value: 'succeeded' },
                { label: 'Failed', value: 'failed' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Partially Refunded', value: 'partially_refunded' },
              ],
            },
            {
              key: 'transaction_type',
              label: 'All Types',
              value: filters.transaction_type || '',
              onChange: (v) => handleFilter('transaction_type', v),
              options: [
                { label: 'Payment', value: 'booking_payment' },
                { label: 'Refund', value: 'refund' },
                { label: 'Partial Refund', value: 'partial_refund' },
                { label: 'Provider Payout', value: 'provider_payout' },
                { label: 'Manual Payout', value: 'manual_payout' },
                { label: 'Adjustment', value: 'adjustment' },
                { label: 'Commission', value: 'commission_deduction' },
              ],
            },
          ]}
          actions={
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm font-medium text-primary hover:text-primary-700"
            >
              {showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
            </button>
          }
        />

        {showAdvancedFilters && (
          <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
            <Input
              label="Min Amount"
              type="number"
              placeholder="$0"
              value={amountMin}
              onChange={(e) => { setAmountMin(e.target.value); setPage(1); }}
            />
            <Input
              label="Max Amount"
              type="number"
              placeholder="$999"
              value={amountMax}
              onChange={(e) => { setAmountMax(e.target.value); setPage(1); }}
            />
          </div>
        )}

        <Table
          columns={columns}
          data={data?.rows ?? []}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => router.push(`/finance/transactions/${row.id}`)}
          isLoading={isLoading}
          emptyMessage="No transactions found"
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
