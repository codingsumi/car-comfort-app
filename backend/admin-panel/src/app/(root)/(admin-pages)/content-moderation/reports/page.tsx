'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { Badge, Button, Modal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import type { PlatformReportRow, PlatformReportDetailResponse } from '@/types/contentModeration';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { label: 'Inappropriate behavior', value: 'inappropriate_behavior' },
  { label: 'Poor service quality', value: 'poor_service_quality' },
  { label: 'Fraud/scam', value: 'fraud_scam' },
  { label: 'Offensive communication', value: 'offensive_communication' },
  { label: 'Fake reviews', value: 'fake_reviews' },
  { label: 'Payment dispute', value: 'payment_dispute' },
  { label: 'Safety issue', value: 'safety_issue' },
  { label: 'Vehicle damage', value: 'vehicle_damage' },
  { label: 'Missing item', value: 'missing_item' },
  { label: 'Spam/abuse', value: 'spam_abuse' },
];

function pri(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'neutral';
  return 'success';
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' {
  switch (s) {
    case 'open': return 'warning';
    case 'under_review': return 'primary';
    case 'investigating': return 'primary';
    case 'escalated': return 'danger';
    case 'resolved': return 'success';
    case 'dismissed': return 'neutral';
    default: return 'neutral';
  }
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const [active, setActive] = useState<PlatformReportDetailResponse | null>(null);
  const [note, setNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [status, setStatus] = useState('investigating');

  const params = {
    ...queryParams,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    report_type: filters.report_type || undefined,
    user_type: filters.user_type || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['platform-reports', params, page],
    queryFn: () => contentModerationService.listReports({ ...params, page }).then((r) => r.data.data),
  });

  const noteMut = useMutation({
    mutationFn: () => contentModerationService.addReportNote(active!.report.id, { note, is_internal: true }),
    onSuccess: () => {
      toast.success('Note added');
      setNote('');
      qc.invalidateQueries({ queryKey: ['platform-reports'] });
      if (active) {
        contentModerationService.getReport(active.report.id).then((r) => setActive(r.data.data as PlatformReportDetailResponse));
      }
    },
  });

  const statusMut = useMutation({
    mutationFn: () =>
      contentModerationService.updateReport(active!.report.id, {
        status,
        resolution_notes: resolutionNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['platform-reports'] });
      setActive(null);
    },
  });

  const cols: TableColumn<PlatformReportRow>[] = [
    { key: 'id', label: 'ID' },
    { key: 'reporter', label: 'Reported by', render: (_, r) => r.reporter?.name || '—' },
    { key: 'target', label: 'Target', render: (_, r) => r.target?.name || '—' },
    { key: 'report_type', label: 'Category' },
    { key: 'priority', label: 'Priority', render: (_, r) => <Badge variant={pri(r.priority)}>{r.priority}</Badge> },
    { key: 'status', label: 'Status', render: (_, r) => <Badge variant={statusVariant(r.status)} dot>{r.status.replace(/_/g, ' ')}</Badge> },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (_, r) => new Date(r.created_at).toLocaleString(),
    },
  ];

  return (
    <>
      <PageHeader title="Reported issues" description="Triage user reports with investigation notes and resolutions." />
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search description or names..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Open', value: 'open' },
                { label: 'Under review', value: 'under_review' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Dismissed', value: 'dismissed' },
                { label: 'Escalated', value: 'escalated' },
              ],
            },
            {
              key: 'priority',
              label: 'Priority',
              value: filters.priority || '',
              onChange: (v) => handleFilter('priority', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
              ],
            },
            {
              key: 'report_type',
              label: 'Category',
              value: filters.report_type || '',
              onChange: (v) => handleFilter('report_type', v),
              options: [{ label: 'Any', value: '' }, ...CATEGORIES],
            },
            {
              key: 'user_type',
              label: 'Reporter type',
              value: filters.user_type || '',
              onChange: (v) => handleFilter('user_type', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Customer', value: 'customer' },
                { label: 'Service Provider', value: 'driver' },
              ],
            },
          ]}
        />
      </div>
      <div className="card p-0">
        <Table
          columns={cols}
          data={data?.reports || []}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={async (r) => {
            const res = await contentModerationService.getReport(r.id);
            setActive(res.data.data as PlatformReportDetailResponse);
          }}
        />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={`Report #${active?.report.id ?? ''}`} size="lg">
        {active && (
          <div className="max-h-[75vh] space-y-4 overflow-y-auto text-sm">
            <p className="whitespace-pre-wrap text-secondary-800">{active.report.description}</p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-neutral-600">
              <div>Booking: {active.report.booking?.booking_code || '—'}</div>
              <div>Attachments: {(active.report.attachment_urls as string[] | null)?.length || 0}</div>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-300">Investigation timeline</p>
              <ul className="mt-2 space-y-2 border-l border-neutral-100 pl-3">
                {(active.report.notes || []).map((n) => (
                  <li key={n.id} className="text-xs">
                    <span className="font-medium">{n.admin?.name}</span> · {new Date(n.created_at).toLocaleString()}
                    <p className="mt-0.5 text-neutral-600">{n.note}</p>
                  </li>
                ))}
                {active.audit_timeline?.map((a) => (
                  <li key={`a-${a.id}`} className="text-xs text-neutral-500">
                    {a.action_type} · {new Date(a.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300">Resolution notes (optional)</label>
              <textarea className="input w-full" rows={2} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300">Add investigation note</label>
              <textarea className="input w-full" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" onClick={() => noteMut.mutate()} loading={noteMut.isPending} disabled={!note.trim()}>
                Save note
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-neutral-50 pt-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-300">Set status</label>
                <select className="input text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="under_review">Under review</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
              <Button size="sm" variant="primary" onClick={() => statusMut.mutate()} loading={statusMut.isPending}>
                Update status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  contentModerationService
                    .updateReport(active.report.id, { escalate: true })
                    .then(() => {
                      toast.success('Escalated');
                      qc.invalidateQueries({ queryKey: ['platform-reports'] });
                    })
                }
              >
                Escalate
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
