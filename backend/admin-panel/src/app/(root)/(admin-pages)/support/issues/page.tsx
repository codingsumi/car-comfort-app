'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supportService } from '@/services/support.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/ui';
import { SupportNav } from '@/components/support/SupportNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { CHART_COLORS, formatCategoryLabel, formatDurationHours, formatDurationMinutes } from '@/components/support/formatters';
import { ChartBarIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function SupportIssuesPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['support-issues', queryParams],
    queryFn: () => supportService.getIssueAnalytics(queryParams).then((r) => r.data.data),
  });

  const charts = data?.charts;

  return (
    <>
      <PageHeader title="Issue analytics" description="Track complaint trends, resolution times, and category distribution" />
      <SupportNav />
      <DateRangeControls
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={setPeriod}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatsCard
              title="Avg response time"
              value={formatDurationMinutes(data?.average_response_minutes ?? 0)}
              icon={<ClockIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Avg resolution time"
              value={formatDurationHours(data?.average_resolution_hours ?? 0)}
              icon={<ArrowPathIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Top complaint"
              value={formatCategoryLabel(data?.most_common_complaints?.[0]?.category || 'general')}
              icon={<ChartBarIcon className="h-5 w-5" />}
            />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Ticket volume">
              <LineChart data={charts?.ticket_volume_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#E4101F" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>

            <ChartCard title="Resolutions">
              <BarChart data={charts?.resolution_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#00A416" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Escalations">
              <LineChart data={charts?.escalation_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#FF7A00" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>

            <ChartCard title="Category distribution">
              <PieChart>
                <Pie
                  data={charts?.category_distribution || []}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${formatCategoryLabel(String(name))} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {(charts?.category_distribution || []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, _n, p) => [v, formatCategoryLabel(String(p?.payload?.category))]} />
              </PieChart>
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ListCard
              title="Most common complaints"
              items={(data?.most_common_complaints || []).map((c) => ({
                label: formatCategoryLabel(c.category),
                count: c.count,
              }))}
            />
            <ListCard
              title="Frequent refund reasons"
              items={(data?.frequent_refund_reasons || []).map((r) => ({
                label: r.reason.slice(0, 80),
                count: r.count,
              }))}
            />
            <ListCard
              title="Customer issue categories"
              items={(data?.customer_issue_categories || []).map((c) => ({
                label: formatCategoryLabel(c.category),
                count: c.count,
              }))}
            />
          </div>
        </>
      )}
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold text-secondary-800">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-secondary-800">{title}</h3>
      {!items.length ? (
        <p className="text-sm text-neutral-300">No data in range</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex justify-between text-sm">
              <span className="text-secondary-700">{item.label}</span>
              <span className="font-medium text-secondary-900">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
