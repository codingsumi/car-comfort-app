'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  UsersIcon, UserGroupIcon, TruckIcon, CalendarDaysIcon,
  CurrencyDollarIcon, BanknotesIcon, ReceiptPercentIcon, ArrowPathIcon,
  StarIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { LiveKpiWidgets } from '@/components/reports/LiveKpiWidgets';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatCompact, formatCurrency, CHART_COLORS } from '@/components/reports/formatters';

export default function ReportsDashboardPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } =
    useReportDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-dashboard', queryParams],
    queryFn: () => reportsService.getDashboard(queryParams).then((r) => r.data.data),
  });

  const summary = data?.summary;
  const charts = data?.charts;

  const statCards = [
    { title: 'Total Users', value: summary?.total_users ?? 0, icon: <UsersIcon className="h-5 w-5" /> },
    { title: 'Customers', value: summary?.total_customers ?? 0, icon: <UserGroupIcon className="h-5 w-5" /> },
    { title: 'Providers', value: summary?.total_providers ?? 0, icon: <TruckIcon className="h-5 w-5" /> },
    { title: 'Total Bookings', value: summary?.total_bookings ?? 0, icon: <CalendarDaysIcon className="h-5 w-5" /> },
    { title: 'Active Bookings', value: summary?.active_bookings ?? 0, icon: <ChartBarIcon className="h-5 w-5" /> },
    { title: 'Completed', value: summary?.completed_bookings ?? 0, icon: <ChartBarIcon className="h-5 w-5" /> },
    { title: 'Cancelled', value: summary?.cancelled_bookings ?? 0, icon: <ChartBarIcon className="h-5 w-5" /> },
    { title: 'Gross Revenue', value: formatCompact(summary?.gross_revenue ?? 0), icon: <CurrencyDollarIcon className="h-5 w-5" /> },
    { title: 'Net Revenue', value: formatCompact(summary?.net_revenue ?? 0), icon: <BanknotesIcon className="h-5 w-5" /> },
    { title: 'Commission', value: formatCompact(summary?.platform_commission ?? 0), icon: <ReceiptPercentIcon className="h-5 w-5" /> },
    { title: 'Refunds', value: formatCompact(summary?.refund_totals ?? 0), icon: <ArrowPathIcon className="h-5 w-5" /> },
    { title: 'Avg Booking', value: formatCompact(summary?.average_booking_value ?? 0), icon: <CurrencyDollarIcon className="h-5 w-5" /> },
    { title: 'Satisfaction', value: `${summary?.customer_satisfaction_score ?? 0}/5`, icon: <StarIcon className="h-5 w-5" /> },
  ];

  return (
    <>
      <PageHeader title="Analytics & Reports" description="Centralized business metrics and performance insights" />
      <ReportsNav />
      <LiveKpiWidgets />
      <DateRangeControls
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={setPeriod}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {statCards.map((s) => (
              <StatsCard key={s.title} title={s.title} value={s.value} icon={s.icon} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Booking Trends">
              <BarChart data={charts?.booking_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Bookings" fill="#E4101F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Revenue Trends">
              <AreaChart data={charts?.revenue_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#00A416" fill="#00A416" fillOpacity={0.1} />
              </AreaChart>
            </ChartCard>

            <ChartCard title="New User Registrations">
              <AreaChart data={charts?.user_registrations || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Provider Growth">
              <BarChart data={charts?.provider_growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Providers" fill="#FF7A00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Service Category Performance">
              <PieChart>
                <Pie
                  data={(charts?.service_category_performance || []).map((s) => ({
                    name: s.service_type.replace(/_/g, ' '),
                    value: s.revenue,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {(charts?.service_category_performance || []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
              </PieChart>
            </ChartCard>

            <ChartCard title="Customer Retention">
              <AreaChart data={charts?.customer_retention || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Returning" stroke="#757D8B" fill="#757D8B" fillOpacity={0.1} />
              </AreaChart>
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold text-secondary-900">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
