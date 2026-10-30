'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import {
  onDisconnect,
  onValue,
  push,
  ref as dbPathRef,
  set,
  update,
  serverTimestamp,
  type Database,
} from 'firebase/database';
import {
  FIREBASE_NOT_CONFIGURED_MSG,
  getSupportChatDatabaseAsync,
  SUPPORT_CHAT_ROOT,
} from '@/lib/firebase';
import { supportService } from '@/services/support.service';
import type { SupportMessageRow } from '@/types/support';

export type LiveChatMessage = {
  id: string;
  message: string;
  timestamp: number;
  senderId: string;
  senderRole: string;
  senderName: string;
};

export type SupportTicketLiveChatHandle = {
  sendMessage: (text: string) => Promise<boolean>;
};

type Props = {
  ticketId: number;
  chatLocked: boolean;
  archivedMessages: SupportMessageRow[];
  requesterUserId: number;
  adminUserId: number;
  adminName: string;
  fillHeight?: boolean;
  /** Flat layout for ticket detail page (no outer card / built-in composer). */
  embedded?: boolean;
  hideComposer?: boolean;
};

function parseLiveMessages(raw: unknown): LiveChatMessage[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Object.entries(raw as Record<string, unknown>);
  const parsed: LiveChatMessage[] = [];

  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const m = value as Record<string, unknown>;
    const users = (m.users as Record<string, unknown> | undefined) || {};
    const msg = String(m.msg ?? m.message ?? '').trim();
    if (!msg) continue;
    const senderId = String(m.senderId ?? users.senderId ?? '');
    const senderRole = String(m.sender_role ?? '').toLowerCase();
    parsed.push({
      id: String(m.id ?? m.pushKey ?? key),
      message: msg,
      timestamp: Number(m.timestamp ?? m.timeStamp ?? 0),
      senderId,
      senderRole: senderRole || (senderId === 'support' ? 'admin' : 'user'),
      senderName: String(users.senderName ?? (senderRole === 'admin' ? 'Support' : 'User')),
    });
  }

  return parsed.sort((a, b) => a.timestamp - b.timestamp);
}

function archivedToLive(rows: SupportMessageRow[]): LiveChatMessage[] {
  return rows
    .filter((m) => !m.internal_note)
    .map((m) => ({
      id: `db_${m.id}`,
      message: m.message,
      timestamp: new Date(m.created_at).getTime(),
      senderId: String(m.sender_id),
      senderRole: m.sender_role,
      senderName: m.sender?.name || m.sender_role,
    }));
}

export const SupportTicketLiveChat = forwardRef<SupportTicketLiveChatHandle, Props>(
  function SupportTicketLiveChat(
    {
      ticketId,
      chatLocked,
      archivedMessages,
      requesterUserId,
      adminUserId,
      adminName,
      fillHeight = false,
      embedded = false,
      hideComposer = false,
    },
    ref
  ) {
    const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([]);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const dbRef = useRef<Database | null>(null);

    const mergedMessages = useMemo(() => {
      const archived = archivedToLive(archivedMessages);
      if (chatLocked) return archived;
      const byId = new Map<string, LiveChatMessage>();
      for (const m of archived) byId.set(m.id, m);
      for (const m of liveMessages) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [archivedMessages, chatLocked, liveMessages]);

    const sendMessage = useCallback(
      async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || chatLocked || sending) return false;

        const db = dbRef.current ?? (await getSupportChatDatabaseAsync());
        if (!db) {
          setError(FIREBASE_NOT_CONFIGURED_MSG);
          return false;
        }

        setSending(true);
        setError(null);
        try {
          const messagesRef = dbPathRef(db, `${SUPPORT_CHAT_ROOT}/${ticketId}/messages`);
          const messageRef = push(messagesRef);
          const key = messageRef.key;
          if (!key) throw new Error('Could not create message.');

          const timestamp = Date.now();
          const senderId = String(adminUserId);
          const receiverId = String(requesterUserId);
          const users = {
            senderId,
            receiverId,
            senderName: adminName || 'Support',
            receiverName: 'User',
            senderImage: '',
            receiverImage: '',
          };

          await set(messageRef, {
            id: key,
            pushKey: key,
            msg: trimmed,
            message: trimmed,
            type: 'text',
            timeStamp: String(timestamp),
            timestamp,
            senderId,
            receiverId,
            sender_role: 'admin',
            seen: false,
            isReply: false,
            unreadCount: 0,
            timezone: null,
            attachment: { audio: '', image: '', thumbnail: '', video: '' },
            users,
          });
          await set(dbPathRef(db, `${SUPPORT_CHAT_ROOT}/${ticketId}/users`), users);
          setReply('');
          void supportService
            .notifySupportChat(ticketId, { message_id: key, message: trimmed })
            .catch(() => {});
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to send message');
          return false;
        } finally {
          setSending(false);
        }
      },
      [adminName, adminUserId, chatLocked, requesterUserId, sending, ticketId]
    );

    useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage]);

    useEffect(() => {
      if (chatLocked || !adminUserId) return;

      let unsub: (() => void) | undefined;
      let cancelled = false;

      void (async () => {
        const db = await getSupportChatDatabaseAsync();
        if (cancelled) return;
        if (!db) {
          setError(FIREBASE_NOT_CONFIGURED_MSG);
          return;
        }

        dbRef.current = db;
        const messagesRef = dbPathRef(db, `${SUPPORT_CHAT_ROOT}/${ticketId}/messages`);
        const presenceRef = dbPathRef(db, `${SUPPORT_CHAT_ROOT}/${ticketId}/presence/${adminUserId}`);

        const markActive = async () => {
          const payload = { active: true, userId: String(adminUserId), updatedAt: serverTimestamp() };
          await set(presenceRef, payload);
          try {
            await onDisconnect(presenceRef).update({
              active: false,
              userId: String(adminUserId),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Presence is best-effort.
          }
        };

        void markActive();

        unsub = onValue(
          messagesRef,
          (snapshot) => {
            setLiveMessages(parseLiveMessages(snapshot.val()));
            setError(null);
          },
          (err) => setError(err.message)
        );
      })();

      return () => {
        cancelled = true;
        unsub?.();
        const db = dbRef.current;
        if (db && adminUserId) {
          const presenceRef = dbPathRef(db, `${SUPPORT_CHAT_ROOT}/${ticketId}/presence/${adminUserId}`);
          void update(presenceRef, {
            active: false,
            userId: String(adminUserId),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          void onDisconnect(presenceRef).cancel().catch(() => {});
        }
      };
    }, [ticketId, chatLocked, adminUserId]);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }, [mergedMessages.length]);

    const showBuiltInComposer = !hideComposer && !chatLocked;

    const rootClass = embedded
      ? `flex min-h-[320px] flex-col ${fillHeight ? 'min-h-0 flex-1' : 'h-[min(52vh,520px)]'}`
      : `card flex flex-col ${fillHeight ? 'min-h-0 flex-1' : 'max-h-[min(70vh,640px)]'}`;

    const feedClass = embedded
      ? 'flex flex-1 flex-col overflow-hidden rounded-xl border border-neutral-100 bg-white'
      : 'flex-1 space-y-3 overflow-y-auto rounded-lg border border-neutral-100 bg-neutral-50/50 p-3';

    return (
      <div className={rootClass}>
        {error && (
          <p
            className={
              embedded
                ? 'mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700'
                : 'mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700'
            }
          >
            {error}
          </p>
        )}

        <div ref={scrollRef} className={feedClass}>
          {!mergedMessages.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-50">
                <ChatBubbleLeftRightIcon className="h-7 w-7 text-neutral-300" />
              </div>
              <p className="text-sm font-medium text-secondary-700">No messages yet</p>
              <p className="mt-2 max-w-md text-sm text-neutral-400">
                Start the conversation by replying to the user&apos;s inquiry, or add an internal note
                for your team.
              </p>
            </div>
          ) : (
            <div className={embedded ? 'flex-1 space-y-4 overflow-y-auto p-5' : 'space-y-3'}>
              {mergedMessages.map((m) => {
                const isAdmin = m.senderRole === 'admin' || m.senderId === String(adminUserId);
                return (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      isAdmin
                        ? 'ml-auto bg-primary-50 text-secondary-800'
                        : 'mr-auto border border-neutral-100 bg-neutral-50/80 text-secondary-800'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                      <span className="font-medium text-secondary-600">{m.senderName}</span>
                      <span>{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showBuiltInComposer && !embedded && (
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            <textarea
              className="input min-h-[88px] w-full text-sm"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to customer or provider..."
            />
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!reply.trim() || sending}
              onClick={() => void sendMessage(reply)}
            >
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        )}
      </div>
    );
  }
);

SupportTicketLiveChat.displayName = 'SupportTicketLiveChat';
