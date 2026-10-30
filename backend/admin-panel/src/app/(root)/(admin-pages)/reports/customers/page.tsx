'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Button } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatCurrency } from '@/components/reports/formatters';
import { UserGroupIcon, ArrowPathIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CustomerReportsPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-customers', queryParams],
    queryFn: () => reportsService.getCustomerAnalytics(queryParams).then((r) => r.data.data),
  });

  const { data: retention } = useQuery({
    queryKey: ['reports-customers-retention', queryParams],
    queryFn: () => reportsService.getCustomerRetention(queryParams).then((r) => r.data.data),
  });

  const { data: satisfaction } = useQuery({
    queryKey: ['reports-satisfaction', queryParams],
    queryFn: () => reportsService.getSatisfactionAnalytics(queryParams).then((r) => r.data.data),
  });

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Customer Analytics" description="Acquisition, retention, and lifetime value" />
      <ReportsNav />
      <DateRangeControls period={period} dateFrom={dateFrom} dateTo={dateTo} onPeriodChange={setPeriod} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
      <Button variant="primary" size="sm" className="mb-4" onClick={async () => {
        const res = await reportsService.createExport({ report_type: 'customer_analytics', export_format: 'csv', filters: queryParams });
        toast.success(`Export #${res.data.data.job.id} started`);
      }}>Export</Button>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <StatsCard title="Active Customers" value={s?.active_customers ?? 0} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="New Registrations" value={s?.new_registrations ?? 0} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="Returning" value={s?.returning_customers ?? 0} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="Retention Rate" value={`${s?.retention_rate ?? 0}%`} icon={<ArrowPathIcon className="h-5 w-5" />} />
            <StatsCard title="Churn Rate" value={`${s?.churn_rate ?? 0}%`} icon={<ArrowPathIcon className="h-5 w-5" />} />
            <StatsCard title="Avg Spend" value={formatCurrency(s?.average_customer_spend ?? 0)} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
            <StatsCard title="LTV" value={formatCurrency(s?.lifetime_customer_value ?? 0)} icon={<CurrencyDollarIcon className="h-5 w-5" />} />
            <StatsCard title="Referrals" value={s?.referral_conversions ?? 0} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="Avg Rating" value={`${satisfaction?.summary.average_rating ?? 0}/5`} icon={<UserGroupIcon className="h-5 w-5" />} />
            <StatsCard title="Satisfaction" value={`${satisfaction?.summary.satisfaction_rate ?? 0}%`} icon={<UserGroupIcon className="h-5 w-5" />} />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Satisfaction Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.satisfaction_trends || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg_rating" stroke="#E4101F" fill="#E4101F" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Retention Cohorts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-neutral-300">
                      <th className="px-3 py-2">Cohort</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Retained</th>
                      <th className="px-3 py-2">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(retention?.cohorts || []).map((c) => (
                      <tr key={c.cohort_month} className="border-b border-neutral-50">
                        <td className="px-3 py-2">{c.cohort_month}</td>
                        <td className="px-3 py-2">{c.cohort_size}</td>
                        <td className="px-3 py-2">{c.retained}</td>
                        <td className="px-3 py-2">{c.retention_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Most Active Customers</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-neutral-300"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Bookings</th></tr></thead>
                <tbody>
                  {(data?.top_active_customers || []).map((c) => (
                    <tr key={c.id} className="border-b border-neutral-50"><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2">{c.booking_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Most Profitable Customers</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-neutral-300"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Spent</th></tr></thead>
                <tbody>
                  {(data?.top_profitable_customers || []).map((c) => (
                    <tr key={c.id} className="border-b border-neutral-50"><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2">{formatCurrency(c.total_spent)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
