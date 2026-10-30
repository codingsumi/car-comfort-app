export interface ProviderPerformanceStats {
  total_active_providers: number;
  providers_below_rating: number;
  providers_flagged_this_week: number;
  average_provider_rating: number;
  total_completed_services: number;
  total_vacuum_penalties: number;
  providers_at_service_limit: number;
}

export interface ProviderPerformanceItem {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  created_at: string;
  daily_service_limit: number | null;
  service_limit_enabled: boolean;
  driver_profile: {
    id: number;
    profile_picture: string | null;
    approval_status: string;
    is_completed: boolean;
  } | null;
  avg_rating: number | null;
  total_reviews: number;
  completed_services: number;
  total_earnings: string;
  cancellation_rate: string;
  vacuum_penalties: number;
  complaints_count: number;
  today_completed: number;
  active_flags: number;
}

export interface ProviderPerformanceListResponse {
  providers: ProviderPerformanceItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ProviderMetrics {
  avg_rating: number | null;
  total_completed_services: number;
  total_cancelled_services: number;
  completion_rate: number;
  total_earnings: number;
  complaint_count: number;
  complaint_ratio: number;
  refund_count: number;
  refund_ratio: number;
  satisfaction_score: number;
  total_reviews: number;
  vacuum_penalty_count: number;
  vacuum_penalty_total: number;
}

export interface ProviderFlag {
  id: number;
  provider_id: number;
  flag_type: string;
  severity: 'warning' | 'critical';
  details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_by: number | null;
  resolved_at: string | null;
  resolution_note: string | null;
  flagged_by: 'system' | 'admin';
  created_at: string;
  resolver?: { id: number; name: string } | null;
}

export interface VacuumPenalty {
  id: number;
  provider_id: number;
  booking_id: number | null;
  penalty_amount: string;
  deduction_type: 'fixed' | 'percentage';
  reason: string;
  evidence_urls: string[] | null;
  issued_by: number;
  status: 'pending' | 'applied' | 'reversed';
  created_at: string;
  booking?: { id: number; booking_code: string } | null;
  issuer?: { id: number; name: string } | null;
}

export interface VacuumPenaltyListResponse {
  penalties: VacuumPenalty[];
  total_deductions: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ProviderPerformanceDetail {
  user: ProviderPerformanceItem & {
    driver_profile: Record<string, unknown> | null;
  };
  metrics: ProviderMetrics;
  reviews: ModerationReview[];
  disputes: ProviderDispute[];
  vacuum_penalties: VacuumPenalty[];
  flags: ProviderFlag[];
}

export interface ProviderDispute {
  id: number;
  booking_id: number;
  customer_complaint: string | null;
  provider_response: string | null;
  admin_notes: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  created_at: string;
  booking?: { id: number; booking_code: string };
}

export interface PerformanceCharts {
  earnings_trend: { date: string; earnings: number; services: number }[];
  ratings_trend: { date: string; avg_rating: number; count: number }[];
  completion_trend: { date: string; completed: number; cancelled: number }[];
  complaint_trend: { date: string; count: number }[];
}

export interface ModerationReview {
  id: number;
  booking_id: number;
  reviewer_user_id: number;
  reviewee_user_id: number;
  reviewer_role: string;
  reviewee_role: string;
  rating: number;
  message: string | null;
  is_satisfied: boolean | null;
  moderation_status: 'pending' | 'approved' | 'hidden' | 'removed' | 'flagged';
  moderated_by: number | null;
  moderation_reason: string | null;
  moderated_at: string | null;
  original_message: string | null;
  moderation_notes?: string | null;
  flags_count?: number;
  auto_flag_reasons?: unknown;
  admin_response?: string | null;
  admin_responded_at?: string | null;
  admin_responder_id?: number | null;
  created_at: string;
  reviewer?: { id: number; name: string; email: string };
  reviewee?: { id: number; name: string; email: string };
  booking?: { id: number; booking_code: string };
  images?: { id: number; image_url: string }[];
  moderator?: { id: number; name: string } | null;
}

export interface ReviewListResponse {
  reviews: ModerationReview[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
  removed: number;
  flagged: number;
  avg_rating: number;
}

export interface ServiceLimitInfo {
  provider_id: number;
  provider_name: string;
  daily_service_limit: number | null;
  service_limit_enabled: boolean;
  today_completed: number;
  remaining_slots: number | null;
  limit_reached: boolean;
}

export interface ThresholdSettings {
  min_rating_threshold: string;
  max_cancellation_rate: string;
  max_complaint_count: string;
  max_open_disputes: string;
  default_daily_limit: string;
}
