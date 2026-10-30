'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { StatsCard, Button, Select } from '@/components/ui';
import { notificationManagementService } from '@/services/notificationManagement.service';
import { ArrowDownTrayIcon, ChartBarIcon, EyeIcon, PaperAirplaneIcon, CursorArrowRaysIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/utils/formatDate';

const COLORS = ['#E4101F', '#00A416', '#FFA92C', '#757D8B', '#3B82F6'];

export default function NotificationAnalyticsPage() {
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['notification-analytics', days],
    queryFn: () => notificationManagementService.getAnalytics({ days }),
  });

  const handleExport = async () => {
    const res = await notificationManagementService.exportAnalytics({ days });
    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-analytics-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const daily = (data?.dailySends ?? []).map((r) => ({
    date: String(r.date).slice(0, 10),
    count: Number(r.count),
  }));

  const byChannel = (data?.byChannel ?? []).map((r) => ({
    name: r.channel,
    value: Number(r.count),
  }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Delivery, engagement, and channel performance"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Select
          label="Period"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-40"
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatsCard title="Total sent" value={data?.summary.totalSent ?? 0} icon={<PaperAirplaneIcon className="h-5 w-5" />} />
        <StatsCard title="Delivery rate" value={`${data?.summary.deliveryRate ?? 0}%`} icon={<ChartBarIcon className="h-5 w-5" />} />
        <StatsCard title="Open rate" value={`${data?.summary.openRate ?? 0}%`} icon={<EyeIcon className="h-5 w-5" />} />
        <StatsCard title="Click rate" value={`${data?.summary.clickRate ?? 0}%`} icon={<CursorArrowRaysIcon className="h-5 w-5" />} />
        <StatsCard title="Failed" value={data?.summary.failed ?? 0} icon={<XCircleIcon className="h-5 w-5" />} changeType={data?.summary.failed ? 'negative' : 'neutral'} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-secondary-900">Daily sends</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#E4101F" fill="#E4101F33" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-secondary-900">Channel comparison</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byChannel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {byChannel.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-secondary-900">Device platforms (push)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.deviceBreakdown ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="platform" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#00A416" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Audience Segment Breakdown */}
        {(data?.bySegment ?? []).length > 0 && (
          <div className="card p-4">
            <h3 className="mb-4 text-sm font-semibold text-secondary-900">Audience Segments</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.bySegment ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="segment" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" name="Recipients" fill="#E4101F" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-Campaign Stats Table */}
      {(data?.topCampaigns ?? []).length > 0 && (
        <div className="mt-8 card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-900">Top Campaigns — Delivery &amp; Engagement</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="pb-3 pr-4">Campaign</th>
                  <th className="pb-3 pr-4">Sent</th>
                  <th className="pb-3 pr-4">Opened</th>
                  <th className="pb-3 pr-4">Open Rate</th>
                  <th className="pb-3 pr-4">Clicked</th>
                  <th className="pb-3 pr-4">Click Rate</th>
                  <th className="pb-3 pr-4">Failed</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {(data?.topCampaigns ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/50">
                    <td className="py-3 pr-4 font-medium text-secondary-900 max-w-[200px] truncate">{c.campaign_name}</td>
                    <td className="py-3 pr-4 text-secondary-700">{c.sent.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-secondary-700">{c.opened.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${
                        c.open_rate >= 20 ? 'text-success' : c.open_rate >= 10 ? 'text-warning' : 'text-secondary-700'
                      }`}>{c.open_rate}%</span>
                    </td>
                    <td className="py-3 pr-4 text-secondary-700">{c.clicked.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${
                        c.click_rate >= 5 ? 'text-success' : 'text-secondary-700'
                      }`}>{c.click_rate}%</span>
                    </td>
                    <td className="py-3 pr-4">
                      {c.failed > 0
                        ? <span className="text-danger">{c.failed}</span>
                        : <span className="text-success">0</span>}
                    </td>
                    <td className="py-3 text-xs text-neutral-400">
                      {c.sent_at ? formatDate(c.sent_at, 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
