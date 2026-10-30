import type { SupportTicketRow, SupportMessageRow, ModerationLogRow } from '@/types/contentModeration';

export type { SupportTicketRow, SupportMessageRow, ModerationLogRow };

export interface SupportDashboardSummary {
  open_tickets: number;
  pending_responses: number;
  resolved_tickets: number;
  escalated_tickets: number;
  average_resolution_hours: number;
  customer_complaints: number;
  provider_complaints: number;
  top_issue_category: string;
}

export interface SupportDashboardData {
  summary: SupportDashboardSummary;
  live: {
    new_incoming_tickets: SupportTicketRow[];
    high_priority_cases: SupportTicketRow[];
    escalated_disputes: number;
  };
  recent_tickets: SupportTicketRow[];
}

export interface LiveSupportWidgets {
  new_incoming_tickets: number;
  unread_messages: number;
  high_priority_cases: number;
  escalated_disputes: number;
  pending_responses: number;
}

export interface SupportTicketListResponse {
  tickets: SupportTicketRow[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface SupportTicketDetailResponse {
  ticket: SupportTicketRow & {
    linked_booking?: { id: number; booking_code: string; status: string; scheduled_at?: string } | null;
    requester?: { id: number; name: string; email?: string; phone?: string; role?: string; status?: string };
    assignee?: { id: number; name: string; email?: string } | null;
  };
  messages: SupportMessageRow[];
  messages_pagination: { total: number; page: number; limit: number; total_pages: number };
  activity: ModerationLogRow[];
}

export interface IssueAnalyticsData {
  most_common_complaints: { category: string; count: number }[];
  frequent_refund_reasons: { reason: string; count: number }[];
  provider_complaint_trends: { date: string; count: number }[];
  customer_issue_categories: { category: string; count: number }[];
  average_response_minutes: number;
  average_resolution_hours: number;
  charts: {
    ticket_volume_trends: { date: string; count: number }[];
    resolution_trends: { date: string; count: number }[];
    escalation_trends: { date: string; count: number }[];
    category_distribution: { category: string; count: number }[];
  };
}

export interface FaqRow {
  id: number;
  category_id: number;
  question: string;
  answer: string;
  status: string;
  sort_order: number;
  category?: { id: number; name: string; slug: string };
}

export interface FaqListResponse {
  faqs: FaqRow[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface FaqCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export const TICKET_STATUSES = [
  'open',
  'pending',
  'in_progress',
  'waiting_for_user',
  'escalated',
  'resolved',
  'closed',
] as const;

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical'] as const;

export const TICKET_CATEGORIES = [
  { value: 'booking_issue', label: 'Booking issue' },
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'refund_issue', label: 'Refund issue' },
  { value: 'provider_complaint', label: 'Provider complaint' },
  { value: 'customer_complaint', label: 'Customer complaint' },
  { value: 'app_issue', label: 'App issue' },
  { value: 'technical_issue', label: 'Technical issue' },
  { value: 'account_issue', label: 'Account issue' },
  { value: 'general', label: 'General' },
] as const;
