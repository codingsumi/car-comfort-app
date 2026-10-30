'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Button } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatCompact, formatCurrency } from '@/components/reports/formatters';
import { CurrencyDollarIcon, BanknotesIcon, ArrowPathIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function RevenueReportsPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();

  const { data: revenue, isLoading } = useQuery({
    queryKey: ['reports-revenue', queryParams],
    queryFn: () => reportsService.getRevenueAnalytics(queryParams).then((r) => r.data.data),
  });

  const { data: refunds } = useQuery({
    queryKey: ['reports-refunds', queryParams],
    queryFn: () => reportsService.getRefundAnalytics(queryParams).then((r) => r.data.data),
  });

  const handleExport = async (type: string, format: 'csv' | 'xlsx' = 'csv') => {
    try {
      const res = await reportsService.createExport({ report_type: type, export_format: format, filters: queryParams });
      toast.success(`Export job #${res.data.data.job.id} started`);
    } catch {
      toast.error('Export failed');
    }
  };

  const summary = revenue?.summary;

  return (
    <>
      <PageHeader title="Revenue Analytics" description="Revenue, refunds, and commission trends" />
      <ReportsNav />
      <DateRangeControls period={period} dateFrom={dateFrom} dateTo={dateTo} onPeriodChange={setPeriod} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => handleExport('revenue')}>Export Revenue</Button>
        <Button variant="primary" size="sm" onClick={() => handleExport('refunds')}>Export Refunds</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatsCard title="Gross Revenue" value={formatCompact(summary?.gross_revenue ?? 0)} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
            <StatsCard title="Net Revenue" value={formatCompact(summary?.net_revenue ?? 0)} icon={<BanknotesIcon className="h-5 w-5" />} />
            <StatsCard title="Commission" value={formatCompact(summary?.commission_earned ?? 0)} icon={<ReceiptPercentIcon className="h-5 w-5" />} />
            <StatsCard title="Refunds" value={formatCompact(summary?.total_refunds ?? 0)} icon={<ArrowPathIcon className="h-5 w-5" />} />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Revenue Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => [formatCurrency(Number(v)), undefined]} />
                    <Area type="monotone" dataKey="revenue" stroke="#E4101F" fill="#E4101F" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Refund Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={refunds?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => [formatCurrency(Number(v)), undefined]} />
                    <Bar dataKey="amount" fill="#FFA92C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
