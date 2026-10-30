'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchFilter } from '@/components/shared/SearchFilter';
import { SimpleRichEditor } from '@/components/shared/SimpleRichEditor';
import { Badge, Button, Modal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import type { SupportTicketRow, SupportTicketDetailResponse } from '@/types/contentModeration';
import toast from 'react-hot-toast';

function pri(p: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'neutral';
  return 'success';
}

const QUICK = [
  'Thanks for reaching out — we are looking into this.',
  'Could you please confirm the booking code and approximate time?',
  'We have applied a credit to your account for the inconvenience.',
];

export default function SupportInboxPage() {
  const qc = useQueryClient();
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc',
  });

  const [thread, setThread] = useState<SupportTicketDetailResponse | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [ticketStatus, setTicketStatus] = useState('pending');

  const params = {
    ...queryParams,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    user_type: filters.user_type || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', params, page],
    queryFn: () => contentModerationService.listSupportTickets({ ...params, page }).then((r) => r.data.data),
  });

  const jsonReplyMut = useMutation({
    mutationFn: async () => {
      if (!thread) return;
      await contentModerationService.replySupportTicketJson(thread.ticket.id, { message: reply, internal_note: internal });
    },
    onSuccess: () => {
      toast.success('Sent');
      setReply('');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      if (thread) {
        contentModerationService.getSupportTicket(thread.ticket.id).then((r) => setThread(r.data.data as SupportTicketDetailResponse));
      }
    },
  });

  const statusMut = useMutation({
    mutationFn: async () => {
      if (!thread) return;
      await contentModerationService.updateSupportTicket(thread.ticket.id, { status: ticketStatus });
    },
    onSuccess: () => {
      toast.success('Ticket updated');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  const cols: TableColumn<SupportTicketRow>[] = [
    { key: 'ticket_number', label: 'ID' },
    { key: 'requester', label: 'Sender', render: (_, r) => r.requester?.name || '—' },
    { key: 'user_type', label: 'Type' },
    { key: 'subject', label: 'Subject' },
    { key: 'last_message_preview', label: 'Last message', render: (_, r) => (r.last_message_preview || '').slice(0, 80) },
    { key: 'status', label: 'Status', render: (_, r) => <Badge variant="neutral">{r.status}</Badge> },
    { key: 'priority', label: 'Priority', render: (_, r) => <Badge variant={pri(r.priority)}>{r.priority}</Badge> },
    { key: 'created_at', label: 'Created', render: (_, r) => new Date(r.created_at).toLocaleString() },
  ];

  return (
    <>
      <PageHeader title="Support inbox" description="Respond to customer and provider tickets with internal notes and attachments." />
      <div className="mb-4">
        <SearchFilter
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search ticket #, subject, sender..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: filters.status || '',
              onChange: (v) => handleFilter('status', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Open', value: 'open' },
                { label: 'Pending', value: 'pending' },
                { label: 'Waiting for user', value: 'waiting_for_user' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Closed', value: 'closed' },
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
              key: 'user_type',
              label: 'User type',
              value: filters.user_type || '',
              onChange: (v) => handleFilter('user_type', v),
              options: [
                { label: 'Any', value: '' },
                { label: 'Customer', value: 'customer' },
                { label: 'Service Provider', value: 'driver' },
                { label: 'Garage', value: 'garage' },
              ],
            },
          ]}
        />
      </div>
      <div className="card p-0">
        <Table
          columns={cols}
          data={data?.tickets || []}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={async (r) => {
            const res = await contentModerationService.getSupportTicket(r.id);
            setThread(res.data.data as SupportTicketDetailResponse);
            setTicketStatus(res.data.data.ticket.status);
          }}
        />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={Boolean(thread)} onClose={() => setThread(null)} title={thread?.ticket.ticket_number} size="lg">
        {thread && (
          <div className="flex max-h-[80vh] flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-neutral-100 bg-neutral-50 px-2 py-1 hover:bg-neutral-100"
                  onClick={() => setReply((prev) => (prev ? `${prev}\n\n${q}` : q))}
                >
                  {q.slice(0, 42)}…
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
              {thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${m.internal_note ? 'border border-dashed border-warning bg-warning-50/40' : 'bg-white shadow-sm'}`}
                >
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>
                      {m.sender?.name} ({m.sender_role})
                      {m.internal_note ? ' · internal' : ''}
                    </span>
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-secondary-800">{m.message}</p>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (not emailed to user)
            </label>
            <SimpleRichEditor value={reply} onChange={setReply} minRows={5} placeholder="Reply to ticket..." />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={jsonReplyMut.isPending} onClick={() => jsonReplyMut.mutate()}>
                Send reply
              </Button>
              <div className="flex items-center gap-2">
                <select className="input text-sm" value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="waiting_for_user">Waiting for user</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <Button size="sm" variant="outline" loading={statusMut.isPending} onClick={() => statusMut.mutate()}>
                  Update status
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
