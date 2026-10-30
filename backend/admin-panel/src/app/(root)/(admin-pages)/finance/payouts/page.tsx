'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { financeService } from '@/services/finance.service';
import { providersService, type ProviderListItem } from '@/services/providers.service';
import { useTableState } from '@/hooks/useTableState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Table, Pagination, Badge, StatsCard, Button, Modal, Input, Select } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { TableColumn } from '@/types';
import type { ProviderPayout, PayoutStatus, ProviderEarnings } from '@/types/finance';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatCurrency';

const statusVariant: Record<PayoutStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  paid: 'success',
  scheduled: 'primary',
  pending: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-neutral-50 py-2.5 last:border-0">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className="text-sm font-medium text-secondary-900">{value}</span>
    </div>
  );
}

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState<number | null>(null);
  const [payoutForm, setPayoutForm] = useState({ provider_id: '', amount: '', notes: '' });
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<{ id: number; name: string | null; email: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const {
    page, pageSize, search, sortKey, sortDirection, filters, queryParams,
    setPage, handleSort, handleSearch, handleFilter,
  } = useTableState({ defaultSortKey: 'created_at' });

  const { data: dashboardStats } = useQuery({
    queryKey: ['payout-dashboard'],
    queryFn: () => financeService.getPayoutDashboard().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payouts', queryParams, filters],
    queryFn: () =>
      financeService.listPayouts({
        ...queryParams,
        status: filters.status || undefined,
        search: queryParams.search || undefined,
      }).then((r) => r.data.data),
  });

  const { data: payoutDetail } = useQuery({
    queryKey: ['payout-detail', selectedPayoutId],
    queryFn: () => financeService.getPayoutDetail(selectedPayoutId!).then((r) => r.data.data),
    enabled: !!selectedPayoutId && detailModalOpen,
  });

  const [providerEarnings, setProviderEarnings] = useState<ProviderEarnings | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);

  // Provider search suggestions
  const { data: providerSuggestions, isFetching: searchingProviders } = useQuery({
    queryKey: ['provider-search', providerSearch],
    queryFn: () =>
      providersService.list({ search: providerSearch, limit: 8, page: 1 }).then((r) => r.data.data?.providers ?? []),
    enabled: providerSearch.trim().length >= 1,
    staleTime: 10000,
  });

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectProvider(p: { id: number; name: string | null; email: string }) {
    setSelectedProvider(p);
    setPayoutForm((f) => ({ ...f, provider_id: String(p.id) }));
    setProviderSearch(p.name ?? p.email);
    setShowSuggestions(false);
    fetchEarnings(String(p.id));
  }

  async function fetchEarnings(providerId: string) {
    if (!providerId) return;
    setLoadingEarnings(true);
    try {
      const res = await financeService.getProviderEarnings(Number(providerId));
      setProviderEarnings(res.data.data);
    } catch {
      setProviderEarnings(null);
    } finally {
      setLoadingEarnings(false);
    }
  }

  const payoutMutation = useMutation({
    mutationFn: (data: { provider_id: number; amount: number; notes?: string }) =>
      financeService.processManualPayout(data),
    onSuccess: () => {
      toast.success('Payout processed successfully');
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-dashboard'] });
      setPayoutModalOpen(false);
      setConfirmStep(false);
      setPayoutForm({ provider_id: '', amount: '', notes: '' });
      setProviderEarnings(null);
      setProviderSearch('');
      setSelectedProvider(null);
    },
    onError: () => {
      setConfirmStep(false);
    },
  });

  function handleSubmitPayout() {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }
    payoutMutation.mutate({
      provider_id: Number(payoutForm.provider_id),
      amount: parseFloat(payoutForm.amount),
      notes: payoutForm.notes || undefined,
    });
  }

  const columns: TableColumn<ProviderPayout>[] = [
    {
      key: 'provider',
      label: 'Provider',
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-secondary-900">{row.provider?.name || '—'}</p>
          <p className="text-xs text-neutral-300">{row.provider?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'stripe_destination_account',
      label: 'Stripe Account',
      render: (_, row) => (
        <span className="font-mono text-xs text-neutral-300">{row.stripe_destination_account || 'Not connected'}</span>
      ),
    },
    {
      key: 'gross_amount',
      label: 'Earnings',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-medium text-secondary-900">{formatCurrency(row.gross_amount)}</span>
      ),
    },
    {
      key: 'commission_deducted',
      label: 'Commission',
      render: (_, row) => (
        <span className="text-sm text-secondary-700">{formatCurrency(row.commission_deducted)}</span>
      ),
    },
    {
      key: 'net_amount',
      label: 'Net Amount',
      sortable: true,
      render: (_, row) => (
        <span className="text-sm font-semibold text-success">{formatCurrency(row.net_amount)}</span>
      ),
    },
    {
      key: 'processed_at',
      label: 'Last Payout',
      render: (_, row) => (
        <span className="text-xs text-neutral-300">{formatDate(row.processed_at, 'MMM d, yyyy')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => (
        <Badge variant={statusVariant[row.status] || 'neutral'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'service_count',
      label: 'Services',
      render: (_, row) => <span className="text-sm text-secondary-700">{row.service_count}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Provider Payouts"
        description="Track and process provider payouts"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => {
              setPayoutModalOpen(true);
              setConfirmStep(false);
              setPayoutForm({ provider_id: '', amount: '', notes: '' });
              setProviderEarnings(null);
              setProviderSearch('');
              setSelectedProvider(null);
            }}
          >
            Process Payout
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatsCard
          title="Pending Payouts"
          value={formatCurrency(dashboardStats?.total_pending ?? 0)}
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Paid Payouts"
          value={formatCurrency(dashboardStats?.total_paid ?? 0)}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Failed Payouts"
          value={formatCurrency(dashboardStats?.total_failed ?? 0)}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Upcoming"
          value={formatCurrency(dashboardStats?.total_upcoming ?? 0)}
          icon={<BanknotesIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Platform Revenue"
          value={formatCurrency(dashboardStats?.platform_revenue ?? 0)}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by provider name, email or ID..."
          filters={[
            {
              key: 'status',
              label: 'All Statuses',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Paid', value: 'paid' },
                { label: 'Failed', value: 'failed' },
                { label: 'Cancelled', value: 'cancelled' },
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
          onRowClick={(row) => {
            setSelectedPayoutId(row.id);
            setDetailModalOpen(true);
          }}
          isLoading={isLoading}
          emptyMessage="No payouts found"
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

      {/* Manual Payout Modal */}
      <Modal
        open={payoutModalOpen}
        onClose={() => { setPayoutModalOpen(false); setConfirmStep(false); }}
        title={confirmStep ? 'Confirm Payout' : 'Process Manual Payout'}
        size="md"
      >
        <div className="space-y-4">
          {!confirmStep ? (
            <>
              {/* Provider Search Autocomplete */}
              <div ref={searchRef} className="relative">
                <label className="mb-1 block text-sm font-medium text-secondary-900">
                  Provider
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Search by name, email or ID..."
                  value={providerSearch}
                  onChange={(e) => {
                    setProviderSearch(e.target.value);
                    setSelectedProvider(null);
                    setPayoutForm((f) => ({ ...f, provider_id: '' }));
                    setProviderEarnings(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => providerSearch.length >= 1 && setShowSuggestions(true)}
                  autoComplete="off"
                />
                {selectedProvider && (
                  <p className="mt-1 text-xs text-neutral-400">
                    ID #{selectedProvider.id} · {selectedProvider.email}
                  </p>
                )}
                {showSuggestions && providerSearch.trim().length >= 1 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-100 bg-white shadow-lg">
                    {searchingProviders ? (
                      <div className="px-4 py-3 text-sm text-neutral-300">Searching...</div>
                    ) : (providerSuggestions ?? []).length === 0 ? (
                      <div className="px-4 py-3 text-sm text-neutral-300">No providers found</div>
                    ) : (
                      <ul className="max-h-52 overflow-y-auto divide-y divide-neutral-50">
                        {(providerSuggestions ?? []).map((p: ProviderListItem) => (
                          <li
                            key={p.id}
                            onMouseDown={() => selectProvider(p)}
                            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
                          >
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                              {(p.name ?? p.email)?.charAt(0)?.toUpperCase() || '#'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-secondary-900">{p.name}</p>
                              <p className="truncate text-xs text-neutral-400">{p.email} · ID #{p.id}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {loadingEarnings && <p className="text-sm text-neutral-300">Loading earnings...</p>}
              {providerEarnings && (
                <div className="rounded-lg border border-neutral-100 p-4 space-y-1">
                  <InfoRow label="Total Earnings" value={formatCurrency(providerEarnings.total_earnings)} />
                  <InfoRow label="Commission Deducted" value={formatCurrency(providerEarnings.commission_deducted)} />
                  <InfoRow label="Refund Adjustments" value={formatCurrency(providerEarnings.refund_adjustments)} />
                  <InfoRow label="Total Paid" value={formatCurrency(providerEarnings.total_paid)} />
                  <InfoRow
                    label="Available Balance"
                    value={<span className="font-bold text-success">{formatCurrency(providerEarnings.available_balance)}</span>}
                  />
                </div>
              )}

              <Input
                label="Payout Amount"
                type="number"
                placeholder="0.00"
                value={payoutForm.amount}
                onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                hint={providerEarnings ? `Max: ${formatCurrency(providerEarnings.available_balance)}` : undefined}
              />
              <Input
                label="Notes (optional)"
                value={payoutForm.notes}
                onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                placeholder="Reason for manual payout"
              />
            </>
          ) : (
            <div className="rounded-lg border border-warning-100 bg-warning-50 p-4">
              <p className="text-sm font-medium text-warning-700">
                Are you sure you want to process a payout of{' '}
                <strong>{formatCurrency(parseFloat(payoutForm.amount))}</strong> to{' '}
                <strong>{selectedProvider?.name ?? selectedProvider?.email ?? `Provider #${payoutForm.provider_id}`}</strong>?
              </p>
              {payoutForm.notes && (
                <p className="mt-2 text-xs text-warning-600">Note: {payoutForm.notes}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { confirmStep ? setConfirmStep(false) : setPayoutModalOpen(false); }}>
              {confirmStep ? 'Back' : 'Cancel'}
            </Button>
            <Button
              variant={confirmStep ? 'danger' : 'primary'}
              onClick={handleSubmitPayout}
              loading={payoutMutation.isPending}
              disabled={!payoutForm.provider_id || !payoutForm.amount || parseFloat(payoutForm.amount) <= 0}
            >
              {confirmStep ? 'Confirm & Process' : 'Continue'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payout Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedPayoutId(null); }}
        title="Payout Details"
        size="md"
      >
        {payoutDetail ? (
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">Provider Info</h4>
              <InfoRow label="Name" value={payoutDetail.payout.provider?.name || '—'} />
              <InfoRow label="Email" value={payoutDetail.payout.provider?.email || '—'} />
              <InfoRow label="Stripe Account" value={payoutDetail.payout.stripe_destination_account || 'Not connected'} />
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">Payout Breakdown</h4>
              <InfoRow label="Gross Amount" value={formatCurrency(payoutDetail.payout.gross_amount)} />
              <InfoRow label="Commission Deducted" value={formatCurrency(payoutDetail.payout.commission_deducted)} />
              <InfoRow label="Vacuum Fee Deducted" value={formatCurrency(payoutDetail.payout.vacuum_fee_deducted)} />
              <InfoRow label="Refund Adjustments" value={formatCurrency(payoutDetail.payout.refund_adjustments)} />
              <InfoRow label="Tax Deducted" value={formatCurrency(payoutDetail.payout.tax_deducted)} />
              <InfoRow label="Net Payout" value={<span className="text-lg font-bold text-success">{formatCurrency(payoutDetail.payout.net_amount)}</span>} />
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</h4>
              <InfoRow label="Status" value={<Badge variant={statusVariant[payoutDetail.payout.status] || 'neutral'} dot>{payoutDetail.payout.status}</Badge>} />
              <InfoRow label="Processed At" value={formatDate(payoutDetail.payout.processed_at, 'MMM d, yyyy h:mm a')} />
              <InfoRow label="Processed By" value={payoutDetail.payout.processor?.name || '—'} />
              <InfoRow label="Stripe Transfer ID" value={<span className="font-mono text-xs">{payoutDetail.payout.stripe_transfer_id || '—'}</span>} />
              {payoutDetail.payout.notes && <InfoRow label="Notes" value={payoutDetail.payout.notes} />}
              {payoutDetail.payout.failure_reason && <InfoRow label="Failure Reason" value={<span className="text-danger">{payoutDetail.payout.failure_reason}</span>} />}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </Modal>
    </>
  );
}
