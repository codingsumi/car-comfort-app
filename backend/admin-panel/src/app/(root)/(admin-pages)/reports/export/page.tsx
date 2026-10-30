'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button, Select, Badge } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatDate } from '@/utils/formatDate';
import { resolveMediaUrl } from '@/lib/paths';
import toast from 'react-hot-toast';
import type { ExportJob } from '@/types/analytics';

const EXPORT_TYPES = [
  { label: 'Users', value: 'users' },
  { label: 'Customers', value: 'customers' },
  { label: 'Providers', value: 'providers' },
  { label: 'Bookings', value: 'bookings' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Refunds', value: 'refunds' },
  { label: 'Payouts', value: 'payouts' },
  { label: 'Customer Analytics', value: 'customer_analytics' },
  { label: 'Provider Analytics', value: 'provider_analytics' },
];

function StatusBadge({ status }: { status: ExportJob['status'] }) {
  const map: Record<ExportJob['status'], 'success' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
    completed: 'success',
    processing: 'primary',
    pending: 'warning',
    failed: 'danger',
  };
  return <Badge variant={map[status]} dot>{status}</Badge>;
}

export default function ExportCenterPage() {
  const queryClient = useQueryClient();
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();
  const [reportType, setReportType] = useState('bookings');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

  const { data: history, isLoading } = useQuery({
    queryKey: ['reports-export-history'],
    queryFn: () => reportsService.getExportHistory().then((r) => r.data.data),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      reportsService.createExport({
        report_type: reportType,
        export_format: exportFormat,
        filters: queryParams,
      }),
    onSuccess: (res) => {
      toast.success(`Export job #${res.data.data.job.id} queued`);
      queryClient.invalidateQueries({ queryKey: ['reports-export-history'] });
    },
    onError: () => toast.error('Failed to create export'),
  });

  return (
    <>
      <PageHeader title="Export Center" description="Generate and download reports asynchronously" />
      <ReportsNav />

      <div className="card mb-6">
        <h3 className="mb-4 text-sm font-semibold text-secondary-900">New Export</h3>
        <div className="flex flex-wrap items-end gap-3">
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
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm" />
          </div>
          <div className="w-full sm:w-36">
            <label className="mb-1 block text-xs font-medium text-secondary-700">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm" />
          </div>
          <div className="w-full sm:w-44">
            <Select
              label="Report Type"
              options={EXPORT_TYPES}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-28">
            <Select
              label="Format"
              options={[
                { label: 'CSV', value: 'csv' },
                { label: 'Excel', value: 'xlsx' },
              ]}
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'xlsx')}
            />
          </div>
          <div className="w-full sm:w-auto">
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
              Generate Export
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-secondary-900">Export History</h3>
        {isLoading ? (
          <p className="text-sm text-neutral-300">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-neutral-300">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Format</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Rows</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {(history?.items || []).map((job) => (
                  <tr key={job.id} className="border-b border-neutral-50">
                    <td className="px-3 py-2">#{job.id}</td>
                    <td className="px-3 py-2 capitalize">{job.report_type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 uppercase">{job.export_format}</td>
                    <td className="px-3 py-2"><StatusBadge status={job.status} /></td>
                    <td className="px-3 py-2">{job.row_count ?? '—'}</td>
                    <td className="px-3 py-2">{formatDate(job.created_at)}</td>
                    <td className="px-3 py-2">
                      {job.status === 'completed' && job.generated_file_url ? (
                        <a
                          href={resolveMediaUrl(job.generated_file_url)}
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : job.status === 'failed' ? (
                        <span className="text-danger text-xs">{job.error_message || 'Failed'}</span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!history?.items || history.items.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-neutral-300">
                      No exports yet. Create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
