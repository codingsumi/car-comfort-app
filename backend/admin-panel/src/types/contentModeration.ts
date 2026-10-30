import type { ModerationReview } from '@/types/providerPerformance';

export interface ModerationDashboardSummary {
  pending_reviews: number;
  flagged_reviews: number;
  reported_issues: number;
  open_support_tickets: number;
  removed_content_count: number;
  abuse_spam_reports: number;
  moderation_actions_today: number;
}

export interface ModerationDashboardData {
  summary: ModerationDashboardSummary;
  recent_flagged_reviews: ModerationReview[];
  recent_reports: PlatformReportRow[];
  recent_support_tickets: SupportTicketRow[];
  recent_moderation_actions: ModerationLogRow[];
}

export interface PlatformReportRow {
  id: number;
  reporter_user_id: number;
  target_user_id: number | null;
  booking_id: number | null;
  report_type: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: number | null;
  resolution_notes: string | null;
  escalated_at: string | null;
  attachment_urls?: string[] | null;
  created_at: string;
  reporter?: { id: number; name: string; email?: string; role?: string };
  target?: { id: number; name: string; email?: string; role?: string } | null;
  assignee?: { id: number; name: string } | null;
  booking?: { id: number; booking_code: string } | null;
}

export interface PlatformReportListResponse {
  reports: PlatformReportRow[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface PlatformReportNoteRow {
  id: number;
  note: string;
  created_at: string;
  admin?: { name?: string };
}

export interface PlatformReportDetailResponse {
  report: PlatformReportRow & { notes?: PlatformReportNoteRow[] };
  audit_timeline: ModerationLogRow[];
}

export interface SupportTicketRow {
  id: number;
  ticket_number: string;
  user_id: number;
  user_type: string;
  subject: string;
  category?: string | null;
  status: string;
  priority: string;
  assigned_to: number | null;
  linked_booking_id?: number | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: { id: number; name: string; email?: string; role?: string; status?: string };
  assignee?: { id: number; name: string; email?: string } | null;
}

export interface SupportTicketListResponse {
  tickets: SupportTicketRow[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface SupportMessageRow {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_role: string;
  message: string;
  attachments: string[] | null;
  internal_note: boolean;
  created_at: string;
  sender?: { id: number; name: string; role?: string };
}

export interface SupportTicketDetailResponse {
  ticket: SupportTicketRow;
  messages: SupportMessageRow[];
  messages_pagination: { total: number; page: number; limit: number; total_pages: number };
  activity: ModerationLogRow[];
}

export interface ModerationReviewListResponse {
  reviews: ModerationReview[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface ModerationReviewDetailResponse {
  review: ModerationReview & {
    booking?: unknown;
    auto_flag_reasons?: unknown;
    flags_count?: number;
    moderation_notes?: string | null;
  };
  moderation_history: ModerationLogRow[];
}

export interface ModerationLogRow {
  id: number;
  moderator?: { id: number; name: string; email?: string };
  admin?: { id: number; name: string; email?: string };
  action_type: string;
  target_entity: string;
  entity_type: string;
  entity_id: number;
  previous_status: string | null;
  new_status: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface ModerationLogsResponse {
  logs: ModerationLogRow[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
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
