'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  ShareIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { Badge, Button, Dropdown, EmptyState, Tabs, Modal, Input } from '@/components/ui';
import { SupportNav } from '@/components/support/SupportNav';
import {
  SupportTicketLiveChat,
  type SupportTicketLiveChatHandle,
} from '@/components/support/SupportTicketLiveChat';
import { useAuthStore } from '@/store/auth';
import { supportService } from '@/services/support.service';
import { contentModerationService } from '@/services/contentModeration.service';
import { usersService } from '@/services/users.service';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@/types/support';
import type { SupportMessageRow } from '@/types/support';
import { formatCategoryLabel, priorityVariant, statusVariant } from '@/components/support/formatters';

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatPriorityLabel(priority: string): string {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return `${label} priority`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm text-neutral-400">{label}</span>
      <span className="text-right text-sm font-medium text-secondary-800">{value}</span>
    </div>
  );
}

function SidebarCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-secondary-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function SupportTicketDetailPage() {
  const { id: idParam } = useParams();
  const ticketId = Number(idParam);
  const qc = useQueryClient();
  const adminUser = useAuthStore((s) => s.user);
  const chatRef = useRef<SupportTicketLiveChatHandle>(null);

  const [composerTab, setComposerTab] = useState<'reply' | 'internal'>('reply');
  const [replyDraft, setReplyDraft] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Email compose modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' });

  const emailMutation = useMutation({
    mutationFn: (data: { to_email: string; to_name?: string; subject: string; message: string; ticket_id: number }) =>
      contentModerationService.sendEmailToCustomer(data),
    onSuccess: () => {
      toast.success('Email sent to customer');
      setShowEmailModal(false);
      setEmailForm({ subject: '', message: '' });
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
    },
    onError: () => toast.error('Failed to send email'),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => supportService.getTicket(ticketId, { messages_limit: 100 }).then((r) => r.data.data),
    enabled: Number.isFinite(ticketId),
    refetchInterval: (query) => {
      const s = query.state.data?.ticket?.status;
      if (s === 'resolved' || s === 'closed') return false;
      return 30000;
    },
  });

  const ticket = data?.ticket;

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAssignedTo(ticket.assigned_to ? String(ticket.assigned_to) : '');
  }, [ticket]);

  const { data: admins } = useQuery({
    queryKey: ['admin-users-assign'],
    queryFn: () => usersService.list({ type: 'admin', limit: 100 }).then((r) => r.data.data?.users || []),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['support-tickets'] });
    qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
    refetch();
  };

  const noteMut = useMutation({
    mutationFn: () => supportService.addInternalNote(ticketId, { note: internalNote }),
    onSuccess: () => {
      toast.success('Internal note saved');
      setInternalNote('');
      invalidate();
    },
  });

  const statusMut = useMutation({
    mutationFn: () => supportService.updateTicket(ticketId, { status, priority }),
    onSuccess: () => {
      toast.success('Ticket updated');
      invalidate();
    },
  });

  const assignMut = useMutation({
    mutationFn: (strategy?: 'manual' | 'round_robin' | 'priority') =>
      supportService.assignTicket(ticketId, {
        assigned_to: assignedTo ? Number(assignedTo) : undefined,
        strategy: strategy || 'manual',
      }),
    onSuccess: () => {
      toast.success('Ticket assigned');
      invalidate();
    },
  });

  const escalateMut = useMutation({
    mutationFn: () => supportService.escalateTicket(ticketId),
    onSuccess: () => {
      toast.success('Ticket escalated');
      setStatus('escalated');
      invalidate();
    },
  });

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleSendReply = async () => {
    if (!replyDraft.trim() || sendingReply) return;
    setSendingReply(true);
    const ok = await chatRef.current?.sendMessage(replyDraft);
    setSendingReply(false);
    if (ok) {
      setReplyDraft('');
      toast.success('Reply sent');
    }
  };

  if (isLoading) {
    return (
      <>
        <SupportNav />
        <div className="mt-6 h-[480px] animate-pulse rounded-xl bg-neutral-50" />
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <SupportNav />
        <EmptyState title="Ticket not found" description="This ticket may have been removed." />
        <Link href="/support/tickets" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to tickets
        </Link>
      </>
    );
  }

  const userProfileHref =
    ticket.user_type === 'customer'
      ? `/customers/${ticket.user_id}`
      : ticket.user_type === 'driver' || ticket.user_type === 'garage'
        ? `/providers/${ticket.user_id}`
        : null;

  const category = (ticket as { category?: string }).category || 'general';
  const chatLocked = ticket.status === 'resolved' || ticket.status === 'closed';
  const archivedMessages = (data?.messages || []).filter((m) => !m.internal_note);
  const internalMessages = (data?.messages || []).filter((m) => m.internal_note);
  const adminUserId = adminUser?.id ?? 0;
  const adminName = adminUser?.name || 'Support';
  const requesterStatus = ticket.requester?.status || 'active';
  const isRequesterActive = requesterStatus === 'active';

  const menuItems = [
    {
      label: 'Escalate ticket',
      onClick: () => escalateMut.mutate(),
    },
    chatLocked
      ? {
          label: 'Reopen ticket',
          onClick: () =>
            supportService.updateTicket(ticketId, { status: 'open' }).then(() => {
              toast.success('Ticket reopened');
              invalidate();
            }),
        }
      : {
          label: 'Mark as resolved',
          onClick: () => {
            setStatus('resolved');
            supportService.updateTicket(ticketId, { status: 'resolved', priority }).then(() => {
              toast.success('Ticket resolved');
              invalidate();
            });
          },
        },
    !chatLocked
      ? {
          label: 'Close ticket',
          onClick: () =>
            supportService.updateTicket(ticketId, { status: 'closed', priority }).then(() => {
              toast.success('Ticket closed');
              invalidate();
            }),
        }
      : null,
  ].filter(Boolean) as { label: string; onClick: () => void }[];

  return (
    <>
      <SupportNav />

      <div className="mb-6">
        <Link
          href="/support/tickets"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition-colors hover:text-primary"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to tickets
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                {ticket.ticket_number}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-secondary-900 sm:text-2xl">{ticket.subject}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(ticket.status)} dot>
                  {ticket.status.replace(/_/g, ' ')}
                </Badge>
                <Badge variant={priorityVariant(ticket.priority)}>
                  {formatPriorityLabel(ticket.priority)}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmailForm({
                    subject: `Re: ${ticket.subject}`,
                    message: '',
                  });
                  setShowEmailModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-secondary-600 transition-colors hover:bg-neutral-50"
              >
                <EnvelopeIcon className="h-4 w-4" />
                Email Customer
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-secondary-600 transition-colors hover:bg-neutral-50"
              >
                <ShareIcon className="h-4 w-4" />
                Share
              </button>
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="More actions"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                }
                items={menuItems}
              />
            </div>
          </div>

          <SupportTicketLiveChat
            ref={chatRef}
            ticketId={ticketId}
            chatLocked={chatLocked}
            archivedMessages={archivedMessages}
            requesterUserId={ticket.user_id}
            adminUserId={adminUserId}
            adminName={adminName}
            embedded
            hideComposer
          />

          <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm">
            <Tabs
              tabs={[
                { key: 'reply', label: 'Reply to customer' },
                { key: 'internal', label: 'Add internal note' },
              ]}
              activeTab={composerTab}
              onChange={(k) => setComposerTab(k as 'reply' | 'internal')}
            />
            <div className="p-5">
              {composerTab === 'reply' ? (
                chatLocked ? (
                  <p className="text-sm text-neutral-400">
                    This ticket is {ticket.status.replace(/_/g, ' ')}. Reopen it to send new messages.
                  </p>
                ) : (
                  <>
                    <textarea
                      className="input min-h-[120px] w-full resize-y text-sm"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Type your response here..."
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-50 pt-4">
                      <p className="text-xs text-neutral-400">Messages are delivered in real time via live chat</p>
                      <Button
                        loading={sendingReply}
                        disabled={!replyDraft.trim()}
                        onClick={() => void handleSendReply()}
                      >
                        Send reply
                      </Button>
                    </div>
                  </>
                )
              ) : (
                <>
                  <textarea
                    className="input min-h-[120px] w-full resize-y border-dashed text-sm"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Private note for your team (not visible to the user)..."
                  />
                  <div className="mt-4 flex justify-end border-t border-neutral-50 pt-4">
                    <Button
                      variant="outline"
                      loading={noteMut.isPending}
                      disabled={!internalNote.trim()}
                      onClick={() => noteMut.mutate()}
                    >
                      Save internal note
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {internalMessages.length > 0 && (
            <div className="rounded-xl border border-dashed border-warning/40 bg-warning-50/30 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-warning-700">
                Internal notes
              </h4>
              <div className="space-y-3">
                {internalMessages.map((m) => (
                  <InternalNoteBubble key={m.id} message={m} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <SidebarCard title="Ticket details">
            <div className="divide-y divide-neutral-50">
              <DetailRow label="Category" value={formatCategoryLabel(category)} />
              <DetailRow
                label="Created"
                value={new Date(ticket.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              />
              <DetailRow label="Updated" value={timeAgo(ticket.updated_at)} />
              {ticket.assignee && <DetailRow label="Assigned" value={ticket.assignee.name} />}
            </div>
          </SidebarCard>

          <SidebarCard
            title="User information"
            action={
              userProfileHref ? (
                <Link href={userProfileHref} className="text-xs font-medium text-primary hover:underline">
                  View profile
                </Link>
              ) : undefined
            }
          >
            <div className="space-y-3">
              <div>
                <p className="font-medium text-secondary-900">{ticket.requester?.name || '—'}</p>
                <p className="mt-0.5 text-sm text-neutral-400">{ticket.requester?.email || '—'}</p>
              </div>
              <div className="divide-y divide-neutral-50 border-t border-neutral-50 pt-3">
                <DetailRow
                  label="User type"
                  value={ticket.user_type.charAt(0).toUpperCase() + ticket.user_type.slice(1)}
                />
                <DetailRow
                  label="Account status"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isRequesterActive ? 'bg-success' : 'bg-neutral-300'}`}
                      />
                      {requesterStatus.charAt(0).toUpperCase() + requesterStatus.slice(1)}
                    </span>
                  }
                />
              </div>
              {ticket.linked_booking && (
                <Link
                  href={`/bookings/${ticket.linked_booking.id}`}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Booking {ticket.linked_booking.booking_code}
                </Link>
              )}
            </div>
          </SidebarCard>

          <SidebarCard title="Admin actions">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-400">Status</span>
                <select
                  className="input w-full text-sm capitalize"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-400">Priority</span>
                <select
                  className="input w-full text-sm capitalize"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-400">Assign to</span>
                <select
                  className="input w-full text-sm"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {adminUser?.id && (
                    <option value={String(adminUser.id)}>
                      Self ({adminName})
                    </option>
                  )}
                  {(admins || [])
                    .filter((a) => a.id !== adminUser?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || `Admin #${a.id}`}
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" loading={statusMut.isPending} onClick={() => statusMut.mutate()}>
                  Save changes
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  loading={assignMut.isPending}
                  onClick={() => assignMut.mutate('manual')}
                >
                  Assign
                </Button>
              </div>
              <button
                type="button"
                className="w-full text-center text-xs font-medium text-neutral-400 transition-colors hover:text-primary"
                onClick={() => assignMut.mutate('round_robin')}
              >
                Round-robin assign
              </button>
            </div>
          </SidebarCard>

          {data?.activity && data.activity.length > 0 && (
            <SidebarCard title="Activity log">
              <ul className="max-h-52 space-y-3 overflow-y-auto text-xs">
                {data.activity.map((a) => (
                  <li key={a.id} className="border-b border-neutral-50 pb-2 last:border-0">
                    <p className="font-medium text-secondary-700">{a.action_type.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-neutral-400">
                      {a.admin?.name || 'System'} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </SidebarCard>
          )}
        </aside>
      </div>

      {/* Email Customer Modal */}
      <Modal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Email Customer"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-neutral-50 px-4 py-3">
            <p className="text-sm text-secondary-700">
              <span className="font-medium">To:</span>{' '}
              {ticket?.requester?.name && <span>{ticket.requester.name} &lt;</span>}
              <span className="text-primary">{ticket?.requester?.email || '—'}</span>
              {ticket?.requester?.name && <span>&gt;</span>}
            </p>
          </div>
          <Input
            label="Subject"
            value={emailForm.subject}
            onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Email subject"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Message <span className="text-danger">*</span>
            </label>
            <textarea
              className="input w-full"
              rows={8}
              value={emailForm.message}
              onChange={(e) => setEmailForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Type your message to the customer..."
            />
          </div>
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-xs text-neutral-400">
              This email will be sent from CarComfort Support and logged as an internal note on this ticket.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<EnvelopeIcon className="h-4 w-4" />}
              loading={emailMutation.isPending}
              disabled={!emailForm.subject.trim() || !emailForm.message.trim()}
              onClick={() => {
                if (!ticket?.requester?.email) {
                  toast.error('No customer email on this ticket');
                  return;
                }
                emailMutation.mutate({
                  to_email: ticket.requester.email,
                  to_name: ticket.requester.name || undefined,
                  subject: emailForm.subject,
                  message: emailForm.message,
                  ticket_id: ticketId,
                });
              }}
            >
              Send Email
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function InternalNoteBubble({ message: m }: { message: SupportMessageRow }) {
  return (
    <div className="rounded-lg border border-dashed border-warning/50 bg-white/80 px-3 py-2 text-sm">
      <div className="flex justify-between gap-2 text-xs text-neutral-400">
        <span>{m.sender?.name || 'Admin'}</span>
        <span>{new Date(m.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-secondary-700">{m.message}</p>
    </div>
  );
}
