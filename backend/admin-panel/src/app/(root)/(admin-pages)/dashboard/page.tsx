'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/Badge';
import {
  UsersIcon,
  TruckIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/formatDate';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import type { Booking } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SparklinePoint { day: string; count?: number; total?: number }
interface Trend { current: number; previous: number; change: number }

interface DashboardData {
  totalUsers: number;
  totalDrivers: number;
  totalCustomers: number;
  totalBookings: number;
  totalRevenue: number;
  activeBookings: number;
  pendingDriverApprovals: number;
  recentBookings: Booking[];
  sparklines?: {
    users: SparklinePoint[];
    bookings: SparklinePoint[];
    revenue: SparklinePoint[];
    customers: SparklinePoint[];
  };
  trends?: {
    users: Trend;
    bookings: Trend;
    revenue: Trend;
    customers: Trend;
    drivers: Trend;
  };
}

// ── Sparkline mini chart ─────────────────────────────────────────────────────

function MiniSparkline({ data, dataKey, color }: { data: SparklinePoint[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '2px 6px', borderRadius: 6 }}
          labelFormatter={(v) => String(v)}
          formatter={(v) => [typeof v === 'number' && dataKey === 'total' ? `$${(v as number).toFixed(0)}` : v, '']}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ change }: { change: number }) {
  if (change === 0) return <span className="text-xs text-neutral-300">No change</span>;
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
      {up
        ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
        : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
      {up ? '+' : ''}{change}% vs last 7d
    </span>
  );
}

// ── KPI Card with sparkline ──────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  sparklineData?: SparklinePoint[];
  sparklineKey?: string;
  sparklineColor?: string;
  trend?: Trend;
}

function KpiCard({ title, value, icon, sparklineData, sparklineKey = 'count', sparklineColor = '#E4101F', trend }: KpiCardProps) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-300">{title}</p>
          <p className="mt-1 text-2xl font-bold text-secondary-900">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
          {icon}
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="-mx-1">
          <MiniSparkline data={sparklineData} dataKey={sparklineKey} color={sparklineColor} />
        </div>
      )}

      {trend !== undefined && (
        <div className="border-t border-neutral-100 pt-2">
          <TrendBadge change={trend.change} />
        </div>
      )}
    </div>
  );
}

// ── Booking status badge ─────────────────────────────────────────────────────

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'primary' | 'neutral'; label: string }> = {
    completed: { variant: 'success', label: 'Completed' },
    in_progress: { variant: 'primary', label: 'In Progress' },
    pending: { variant: 'warning', label: 'Pending' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    scheduled: { variant: 'neutral', label: 'Scheduled' },
  };
  const s = map[status] || { variant: 'neutral' as const, label: status };
  return <Badge variant={s.variant} dot>{s.label}</Badge>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats().then((r) => r.data.data as DashboardData),
    refetchInterval: 60000,
  });

  const kpis: KpiCardProps[] = [
    {
      title: 'Total Users',
      value: data?.totalUsers ?? 0,
      icon: <UsersIcon className="h-5 w-5" />,
      sparklineData: data?.sparklines?.users,
      trend: data?.trends?.users,
    },
    {
      title: 'Service Providers',
      value: data?.totalDrivers ?? 0,
      icon: <TruckIcon className="h-5 w-5" />,
      trend: data?.trends?.drivers,
    },
    {
      title: 'Customers',
      value: data?.totalCustomers ?? 0,
      icon: <UserGroupIcon className="h-5 w-5" />,
      sparklineData: data?.sparklines?.customers,
      trend: data?.trends?.customers,
    },
    {
      title: 'Total Bookings',
      value: data?.totalBookings ?? 0,
      icon: <CalendarDaysIcon className="h-5 w-5" />,
      sparklineData: data?.sparklines?.bookings,
      trend: data?.trends?.bookings,
    },
    {
      title: 'Total Revenue',
      value: `$${(data?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: <CurrencyDollarIcon className="h-5 w-5" />,
      sparklineData: data?.sparklines?.revenue,
      sparklineKey: 'total',
      sparklineColor: '#00A416',
      trend: data?.trends?.revenue,
    },
    {
      title: 'Active Bookings',
      value: data?.activeBookings ?? 0,
      icon: <ClockIcon className="h-5 w-5" />,
    },
    {
      title: 'Pending Approvals',
      value: data?.pendingDriverApprovals ?? 0,
      icon: <ExclamationCircleIcon className="h-5 w-5" />,
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Platform overview — last 7 days vs prior 7 days" />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-neutral-100" />
                  <div className="h-7 w-14 rounded bg-neutral-100" />
                </div>
                <div className="h-9 w-9 rounded-lg bg-neutral-100" />
              </div>
              <div className="mt-3 h-10 w-full rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      )}

      {/* ── Recent Bookings ── */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-secondary-900">Recent Bookings</h2>
        <div className="table-container">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  {['Booking Code', 'Customer', 'Status', 'Fare', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(data?.recentBookings ?? []).map((booking: Booking) => (
                  <tr key={booking.id} className="hover:bg-neutral-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                      {booking.booking_code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                      {booking.user?.name || booking.user?.email || `#${booking.user_id}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                      {booking.total_price ? `$${parseFloat(booking.total_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                      {formatDate(booking.created_at)}
                    </td>
                  </tr>
                ))}
                {(!data?.recentBookings || data.recentBookings.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-300">
                      No recent bookings
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
