'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  StarIcon, ChatBubbleLeftRightIcon, FaceSmileIcon,
  ArrowTrendingUpIcon, ExclamationTriangleIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Button, Badge } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';

const COLORS = ['#00A416', '#E4101F', '#FFA92C', '#757D8B', '#3B82F6', '#FF7A00'];

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#00A416',
  neutral: '#FFA92C',
  negative: '#E4101F',
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={`h-5 w-5 ${i < Math.round(value) ? 'fill-warning text-warning' : 'text-neutral-200'}`}
        />
      ))}
      <span className="ml-1 text-sm font-semibold text-secondary-900">{value.toFixed(2)}</span>
    </div>
  );
}

function ScoreGauge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 70 ? '#00A416' : pct >= 40 ? '#FFA92C' : '#E4101F';
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative h-20 w-40">
        <svg viewBox="0 0 100 50" className="h-full w-full">
          <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="#f0f0f0" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 141.37} 141.37`}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-2xl font-bold text-secondary-900">{value}</span>
        </div>
      </div>
      <span className="text-xs text-neutral-400">out of {max}</span>
    </div>
  );
}

export default function SatisfactionPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } =
    useReportDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['reports-satisfaction', queryParams],
    queryFn: () => reportsService.getSatisfactionAnalytics(queryParams).then((r) => r.data.data),
  });

  const summary = data?.summary;

  const handleExport = async () => {
    try {
      const res = await reportsService.createExport({
        report_type: 'customer_analytics',
        export_format: 'csv',
        filters: queryParams,
      });
      toast.success(`Export #${res.data.data.job.id} started — check Export Center`);
    } catch {
      toast.error('Export failed');
    }
  };

  const ratingTrend = (data?.rating_trends ?? []).map((r) => ({
    date: String(r.date).slice(0, 10),
    rating: Number(r.avg_rating).toFixed(2),
    count: Number(r.count),
  }));

  const sentimentData = (data?.sentiment_breakdown ?? []).map((s) => ({
    name: s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1),
    value: Number(s.count),
    color: SENTIMENT_COLORS[s.sentiment] || '#757D8B',
  }));

  const issuesData = (data?.common_issues ?? []).map((i) => ({
    name: i.report_type.replace(/_/g, ' '),
    count: Number(i.count),
  }));

  // NPS bucket label
  const nps = summary?.nps_proxy ?? 0;
  const npsLabel = nps >= 50 ? 'Excellent' : nps >= 30 ? 'Good' : nps >= 0 ? 'Fair' : 'Poor';
  const npsVariant: 'success' | 'warning' | 'danger' | 'neutral' = nps >= 50 ? 'success' : nps >= 30 ? 'neutral' : nps >= 0 ? 'warning' : 'danger';

  return (
    <>
      <PageHeader
        title="Customer Satisfaction"
        description="Satisfaction scores, rating trends, sentiment analysis, and complaint breakdown"
        actions={
          <Button variant="outline" size="sm" icon={<ArrowDownTrayIcon className="h-4 w-4" />} onClick={handleExport}>
            Export
          </Button>
        }
      />
      <ReportsNav />
      <DateRangeControls
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={setPeriod}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-neutral-50" />
          ))}
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatsCard
              title="Average Rating"
              value={`${summary?.average_rating?.toFixed(2) ?? '—'} / 5`}
              icon={<StarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Total Reviews"
              value={summary?.total_reviews ?? 0}
              icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Satisfaction Rate"
              value={`${summary?.satisfaction_rate ?? 0}%`}
              icon={<FaceSmileIcon className="h-5 w-5" />}
              changeType={(summary?.satisfaction_rate ?? 0) >= 70 ? 'positive' : 'negative'}
            />
            <StatsCard
              title="NPS Proxy"
              value={summary?.nps_proxy ?? 0}
              icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
              changeType={(summary?.nps_proxy ?? 0) >= 30 ? 'positive' : 'negative'}
            />
            <StatsCard
              title="Complaint Rate"
              value={`${summary?.complaint_rate ?? 0}%`}
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              changeType={(summary?.complaint_rate ?? 0) > 5 ? 'negative' : 'neutral'}
            />
            <StatsCard
              title="Refund Rate"
              value={`${summary?.refund_percentage ?? 0}%`}
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              changeType={(summary?.refund_percentage ?? 0) > 3 ? 'negative' : 'neutral'}
            />
          </div>

          {/* Score spotlight */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="card flex flex-col items-center justify-center py-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Average Rating
              </p>
              <StarRating value={summary?.average_rating ?? 0} />
              <p className="mt-2 text-xs text-neutral-400">
                from {(summary?.total_reviews ?? 0).toLocaleString()} reviews
              </p>
            </div>

            <div className="card flex flex-col items-center justify-center py-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                NPS Score
              </p>
              <ScoreGauge value={summary?.nps_proxy ?? 0} max={100} />
              <Badge variant={npsVariant} className="mt-2">{npsLabel}</Badge>
            </div>

            <div className="card flex flex-col items-center justify-center py-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Satisfaction Rate
              </p>
              <p className="text-5xl font-bold text-secondary-900">
                {summary?.satisfaction_rate ?? 0}%
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                of customers rated 4★ or higher
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Rating trend over time */}
            <div className="card lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Rating Trend Over Time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ratingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}★`} />
                    <Tooltip formatter={(v) => [`${v}★`, 'Avg Rating']} />
                    <ReferenceLine y={4} stroke="#00A416" strokeDasharray="4 4" label={{ value: 'Target 4★', position: 'right', fontSize: 10, fill: '#00A416' }} />
                    <Area
                      type="monotone"
                      dataKey="rating"
                      stroke="#E4101F"
                      fill="#E4101F"
                      fillOpacity={0.1}
                      name="Avg Rating"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sentiment breakdown */}
            {sentimentData.length > 0 && (
              <div className="card">
                <h3 className="mb-4 text-sm font-semibold text-secondary-900">Sentiment Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {sentimentData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, 'Reviews']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {sentimentData.map((s) => (
                    <div key={s.name} className="rounded-lg p-3 text-center" style={{ background: `${s.color}15` }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400">{s.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common issues / complaints */}
            {issuesData.length > 0 && (
              <div className="card">
                <h3 className="mb-4 text-sm font-semibold text-secondary-900">Common Issues &amp; Complaints</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={issuesData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Reports" fill="#E4101F" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Review volume over time */}
            <div className="card lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Review Volume Over Time</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Reviews" fill="#3B82F6" radius={[4, 4, 0, 0]} />
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
