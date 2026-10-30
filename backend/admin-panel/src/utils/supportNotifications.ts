import type { Notification } from '@/types';

type NotificationData = {
  kind?: string;
  ticket_id?: string | number;
  ticketId?: string | number;
};

export function isSupportTicketNotificationType(type: string | null | undefined): boolean {
  const t = String(type || '').toUpperCase();
  return (
    t === 'SUPPORT_TICKET_CREATED' ||
    t === 'SUPPORT_TICKET_MESSAGE' ||
    t === 'SUPPORT_TICKET_REPLY' ||
    t === 'SUPPORT_TICKET_RESOLVED'
  );
}

export function ticketIdFromNotification(notification: Notification): number | null {
  const raw = notification as Notification & { data?: NotificationData };
  const id = raw.data?.ticket_id ?? raw.data?.ticketId;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function supportTicketsChatHref(ticketId: number): string {
  return `/support/tickets/${ticketId}`;
}
