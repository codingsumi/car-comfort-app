'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Badge, Button, EmptyState } from '@/components/ui';
import { SupportTicketLiveChat } from '@/components/support/SupportTicketLiveChat';
import { useAuthStore } from '@/store/auth';
import { supportService } from '@/services/support.service';
import { priorityVariant } from '@/components/support/formatters';
import { TICKET_STATUSES } from '@/types/support';
import type { SupportMessageRow } from '@/types/support';

type Props = {
  ticketId: number;
  onClose?: () => void;
};

function MessageBubble({ message: m, internal }: { message: SupportMessageRow; internal?: boolean }) {
  const isAdmin = m.sender_role === 'admin';
  return (
    <div
      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
        internal
          ? 'ml-auto border border-dashed border-warning bg-warning-50/50'
          : isAdmin
            ? 'ml-auto bg-primary-50 text-secondary-800'
            : 'bg-white shadow-sm'
      }`}
    >
      <div className="flex justify-between gap-4 text-xs text-neutral-400">
        <span>
          {m.sender?.name || 'User'} ({m.sender_role})
          {internal ? ' · internal' : ''}
        </span>
        <span>{new Date(m.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
    </div>
  );
}

export function SupportTicketChatPanel({ ticketId, onClose }: Props) {
  const qc = useQueryClient();
  const adminUser = useAuthStore((s) => s.user);
  const [internalNote, setInternalNote] = useState('');
  const [showInternal, setShowInternal] = useState(false);
  const [status, setStatus] = useState('open');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => supportService.getTicket(ticketId, { messages_limit: 100 }).then((r) => r.data.data),
    enabled: Number.isFinite(ticketId) && ticketId > 0,
    refetchInterval: (query) => {
      const s = query.state.data?.ticket?.status;
      if (s === 'resolved' || s === 'closed') return false;
      return 30000;
    },
  });

  const noteMut = useMutation({
    mutationFn: () => supportService.addInternalNote(ticketId, { note: internalNote }),
    onSuccess: () => {
      toast.success('Internal note added');
      setInternalNote('');
      setShowInternal(false);
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      refetch();
    },
  });

  useEffect(() => {
    if (data?.ticket?.status) {
      setStatus(data.ticket.status);
    }
  }, [data?.ticket?.status]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100" />
      </div>
    );
  }

  if (isError || !data?.ticket) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-6">
        <EmptyState title="Could not load ticket" description="Try selecting the ticket again." />
      </div>
    );
  }

  const ticket = data.ticket;
  const chatLocked = ticket.status === 'resolved' || ticket.status === 'closed';
  const archivedMessages = (data.messages || []).filter((m) => !m.internal_note);
  const internalMessages = (data.messages || []).filter((m) => m.internal_note);
  const adminUserId = adminUser?.id ?? 0;
  const adminName = adminUser?.name || 'Support';

  const handleStatusUpdate = async () => {
    if (statusUpdating || !status || status === ticket.status) return;
    setStatusUpdating(true);
    try {
      await supportService.updateTicket(ticketId, { status, priority: ticket.priority });
      toast.success('Ticket status updated');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      refetch();
    } catch {
      toast.error('Failed to update ticket status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const statusDirty = status !== ticket.status;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-400">{ticket.ticket_number}</p>
          <h2 className="truncate text-sm font-semibold text-secondary-900">{ticket.subject}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
            <span className="text-xs text-neutral-400">
              {ticket.requester?.name || 'User'} · {ticket.user_type}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[140px] flex-1 text-xs text-neutral-400">
              Status
              <select
                className="input mt-1 w-full text-sm capitalize"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={statusUpdating}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant={statusDirty ? 'primary' : 'outline'}
              loading={statusUpdating}
              disabled={!statusDirty}
              onClick={() => void handleStatusUpdate()}
            >
              Update status
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/support/tickets/${ticketId}`}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-primary"
            title="Open full ticket page"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-secondary-700"
              aria-label="Close chat"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <SupportTicketLiveChat
            ticketId={ticketId}
            chatLocked={chatLocked}
            archivedMessages={archivedMessages}
            requesterUserId={ticket.user_id}
            adminUserId={adminUserId}
            adminName={adminName}
            fillHeight
          />
        </div>

        <div className="shrink-0 rounded-xl border border-neutral-100 bg-white p-3">
          <Button size="sm" variant="ghost" onClick={() => setShowInternal((s) => !s)}>
            {showInternal ? 'Hide' : 'Add'} internal note
          </Button>
          {showInternal && (
            <div className="mt-2 space-y-2">
              <textarea
                className="input min-h-[72px] w-full text-sm"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Private note (not shown to user)..."
              />
              <Button size="sm" loading={noteMut.isPending} onClick={() => noteMut.mutate()}>
                Save note
              </Button>
            </div>
          )}
          {internalMessages.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
              {internalMessages.map((m) => (
                <MessageBubble key={m.id} message={m} internal />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
