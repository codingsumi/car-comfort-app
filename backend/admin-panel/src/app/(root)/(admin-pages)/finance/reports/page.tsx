'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { financeService } from '@/services/finance.service';
import { providersService, type ProviderListItem } from '@/services/providers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Button, Select, Tabs } from '@/components/ui';
import {
  CurrencyDollarIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ReceiptRefundIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatCompact } from '@/utils/formatCurrency';

const COLORS = ['#E4101F', '#00A416', '#FFA92C', '#757D8B', '#FF7A00', '#3B82F6'];

const SERVICE_TYPE_OPTIONS = [
  { label: 'All Services', value: '' },
  { label: 'Car Wash', value: 'car_wash' },
  { label: 'EV Charging', value: 'ev_charging' },
  { label: 'Combo', value: 'combo' },
  { label: 'Add-On', value: 'add_on' },
  { label: 'Convenience Fee', value: 'convenience_fee' },
  { label: 'Cancellation Fee', value: 'cancellation_fee' },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderListItem | null>(null);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const providerSearchRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const queryParams = useMemo(() => ({
    period: !dateFrom ? period : undefined,
    from_date: dateFrom || undefined,
    to_date: dateTo || undefined,
    service_type: serviceType || undefined,
    provider_id: providerId || undefined,
  }), [period, dateFrom, dateTo, serviceType, providerId]);

  // Provider autocomplete for reports filter
  const { data: reportProviderSuggestions, isFetching: searchingReportProvider } = useQuery({
    queryKey: ['report-provider-search', providerSearch],
    queryFn: () =>
      providersService.list({ search: providerSearch, limit: 8, page: 1 }).then((r) => r.data.data?.providers ?? []),
    enabled: providerSearch.trim().length >= 1,
    staleTime: 10000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (providerSearchRef.current && !providerSearchRef.current.contains(e.target as Node)) {
        setShowProviderSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: revenue } = useQuery({
    queryKey: ['report-revenue', queryParams],
    queryFn: () => financeService.getRevenueReport(queryParams).then((r) => r.data.data),
  });

  const { data: refunds } = useQuery({
    queryKey: ['report-refunds', queryParams],
    queryFn: () => financeService.getRefundReport(queryParams).then((r) => r.data.data),
  });

  const { data: payouts } = useQuery({
    queryKey: ['report-payouts', queryParams],
    queryFn: () => financeService.getPayoutReport(queryParams).then((r) => r.data.data),
  });

  const { data: taxes } = useQuery({
    queryKey: ['report-taxes', queryParams],
    queryFn: () => financeService.getTaxReport(queryParams).then((r) => r.data.data),
  });

  const handleExport = useCallback(async (type: string) => {
    try {
      const response = await financeService.exportReport(type, queryParams);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // error handled by axios interceptor
    }
  }, [queryParams]);

  const summary = revenue?.summary;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'refunds', label: 'Refunds' },
    { key: 'payouts', label: 'Payouts' },
    { key: 'taxes', label: 'Taxes' },
  ];

  return (
    <>
      <PageHeader
        title="Financial Reports"
        description="Revenue analytics and financial insights"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
              onClick={() => handleExport('revenue')}
            >
              Export Revenue
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
              onClick={() => handleExport('commissions')}
            >
              Export Commissions
            </Button>
          </div>
        }
      />

      {/* Date Range + Filter Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-32">
          <Select
            label="Period"
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
            value={dateFrom ? '' : period}
            onChange={(e) => { setPeriod(e.target.value); setDateFrom(''); setDateTo(''); }}
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-secondary-700">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input text-sm"
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-secondary-700">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input text-sm"
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            label="Service Type"
            options={SERVICE_TYPE_OPTIONS}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          />
        </div>
        {/* Provider autocomplete */}
        <div ref={providerSearchRef} className="relative w-full sm:w-52">
          <label className="mb-1 block text-xs font-medium text-secondary-700">Provider</label>
          <input
            type="text"
            placeholder="Search name, email or ID..."
            value={providerSearch}
            onChange={(e) => {
              setProviderSearch(e.target.value);
              setSelectedProvider(null);
              setProviderId('');
              setShowProviderSuggestions(true);
            }}
            onFocus={() => providerSearch.length >= 1 && setShowProviderSuggestions(true)}
            className="input text-sm"
            autoComplete="off"
          />
          {selectedProvider && (
            <p className="mt-0.5 text-xs text-neutral-400 truncate w-52">
              ID #{selectedProvider.id} · {selectedProvider.email}
            </p>
          )}
          {showProviderSuggestions && providerSearch.trim().length >= 1 && (
            <div className="absolute z-50 mt-1 w-64 rounded-lg border border-neutral-100 bg-white shadow-lg">
              {searchingReportProvider ? (
                <div className="px-4 py-3 text-sm text-neutral-300">Searching...</div>
              ) : (reportProviderSuggestions ?? []).length === 0 ? (
                <div className="px-4 py-3 text-sm text-neutral-300">No providers found</div>
              ) : (
                <ul className="max-h-52 overflow-y-auto divide-y divide-neutral-50">
                  {(reportProviderSuggestions ?? []).map((p: ProviderListItem) => (
                    <li
                      key={p.id}
                      onMouseDown={() => {
                        setSelectedProvider(p);
                        setProviderId(String(p.id));
                        setProviderSearch(p.name ?? p.email);
                        setShowProviderSuggestions(false);
                      }}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                        {(p.name ?? p.email)?.charAt(0)?.toUpperCase() || '#'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-secondary-900">{p.name ?? '—'}</p>
                        <p className="truncate text-xs text-neutral-400">{p.email} · ID #{p.id}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {(serviceType || providerId) && (
          <button
            onClick={() => {
              setServiceType('');
              setProviderId('');
              setProviderSearch('');
              setSelectedProvider(null);
            }}
            className="mb-0.5 self-end text-xs font-medium text-neutral-300 hover:text-danger"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <StatsCard
          title="Gross Revenue"
          value={formatCompact(summary?.gross_revenue ?? 0)}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Net Revenue"
          value={formatCompact(summary?.net_revenue ?? 0)}
          icon={<BanknotesIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Commission"
          value={formatCompact(summary?.commission_earned ?? 0)}
          icon={<ReceiptPercentIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Refunds"
          value={formatCompact(summary?.total_refunds ?? 0)}
          icon={<ArrowPathIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending Payouts"
          value={formatCompact(summary?.pending_payouts ?? 0)}
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Paid Payouts"
          value={formatCompact(summary?.paid_payouts ?? 0)}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Taxes"
          value={formatCompact(summary?.taxes_collected ?? 0)}
          icon={<ReceiptRefundIcon className="h-5 w-5" />}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Revenue Trend */}
                <div className="card">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-secondary-900">Revenue Trend</h3>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenue?.trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          formatter={(value) => [formatCurrency(Number(value)), undefined]}
                          labelStyle={{ fontWeight: 600 }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#E4101F" fill="#E4101F" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="refunds" name="Refunds" stroke="#FFA92C" fill="#FFA92C" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bookings Per Day */}
                <div className="card">
                  <h3 className="mb-4 text-sm font-semibold text-secondary-900">Daily Bookings</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenue?.trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Bookings" fill="#E4101F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Service Revenue Pie */}
                {((revenue?.by_service_type ?? taxes?.by_service_type) ?? []).length > 0 && (
                  <div className="card">
                    <h3 className="mb-4 text-sm font-semibold text-secondary-900">Revenue by Service Type</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(revenue?.by_service_type ?? taxes?.by_service_type ?? []).map((s) => ({
                              name: s.service_type.replace(/_/g, ' '),
                              value: s.revenue,
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                          >
                            {(revenue?.by_service_type ?? taxes?.by_service_type ?? []).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'refunds' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <StatsCard title="Total Refunded" value={formatCurrency(refunds?.summary.total_refunded ?? 0)} icon={<ArrowPathIcon className="h-5 w-5" />} />
                  <StatsCard title="Total Requests" value={refunds?.summary.total_requests ?? 0} icon={<ReceiptRefundIcon className="h-5 w-5" />} />
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-secondary-900">Refund Trend</h3>
                    <Button variant="outline" size="sm" onClick={() => handleExport('refunds')}>Export</Button>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={refunds?.trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), undefined]} />
                        <Bar dataKey="amount" name="Refund Amount" fill="#FFA92C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {refunds?.by_status && (
                  <div className="card">
                    <h3 className="mb-4 text-sm font-semibold text-secondary-900">Refunds by Status</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wider text-neutral-300">
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Count</th>
                            <th className="px-4 py-3">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {refunds.by_status.map((s) => (
                            <tr key={s.status}>
                              <td className="px-4 py-3 text-sm font-medium text-secondary-900 capitalize">{s.status}</td>
                              <td className="px-4 py-3 text-sm text-secondary-700">{s.count}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-secondary-900">{formatCurrency(s.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <StatsCard title="Total Paid" value={formatCurrency(payouts?.summary.total_paid ?? 0)} icon={<CheckCircleIcon className="h-5 w-5" />} />
                  <StatsCard title="Commission Earned" value={formatCurrency(payouts?.summary.total_commission ?? 0)} icon={<ReceiptPercentIcon className="h-5 w-5" />} />
                  <StatsCard title="Total Payouts" value={payouts?.summary.total_payouts ?? 0} icon={<BanknotesIcon className="h-5 w-5" />} />
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-secondary-900">Payout Trend</h3>
                    <Button variant="outline" size="sm" onClick={() => handleExport('payouts')}>Export</Button>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={payouts?.trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), undefined]} />
                        <Area type="monotone" dataKey="amount" name="Payouts" stroke="#00A416" fill="#00A416" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'taxes' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <StatsCard title="Total Tax" value={formatCurrency(taxes?.summary.total_tax ?? 0)} icon={<ReceiptRefundIcon className="h-5 w-5" />} />
                  <StatsCard title="Taxed Bookings" value={taxes?.summary.total_bookings ?? 0} icon={<BanknotesIcon className="h-5 w-5" />} />
                </div>

                <div className="card">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-secondary-900">Tax by Service Type</h3>
                    <Button variant="outline" size="sm" onClick={() => handleExport('taxes')}>Export</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wider text-neutral-300">
                          <th className="px-4 py-3">Service Type</th>
                          <th className="px-4 py-3">Tax Collected</th>
                          <th className="px-4 py-3">Revenue</th>
                          <th className="px-4 py-3">Bookings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {(taxes?.by_service_type || []).map((s) => (
                          <tr key={s.service_type}>
                            <td className="px-4 py-3 text-sm font-medium text-secondary-900 capitalize">
                              {s.service_type.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-secondary-900">
                              {formatCurrency(s.tax_collected)}
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-700">{formatCurrency(s.revenue)}</td>
                            <td className="px-4 py-3 text-sm text-secondary-700">{s.count}</td>
                          </tr>
                        ))}
                        {(!taxes?.by_service_type || taxes.by_service_type.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-300">No tax data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
      </div>
    </>
  );
}
