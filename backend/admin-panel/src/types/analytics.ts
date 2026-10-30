export interface DateRange {
  start: string;
  end: string;
}

export interface DashboardSummary {
  total_users: number;
  total_customers: number;
  total_providers: number;
  total_bookings: number;
  active_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  gross_revenue: number;
  net_revenue: number;
  platform_commission: number;
  refund_totals: number;
  average_booking_value: number;
  customer_satisfaction_score: number;
}

export interface TrendPoint {
  date: string;
  count?: number;
  revenue?: number;
  amount?: number;
}

export interface DashboardCharts {
  booking_trends: TrendPoint[];
  revenue_trends: TrendPoint[];
  user_registrations: TrendPoint[];
  provider_growth: TrendPoint[];
  cancellation_trends: TrendPoint[];
  refund_trends: TrendPoint[];
  service_category_performance: {
    service_type: string;
    count: number;
    revenue: number;
  }[];
  customer_retention: TrendPoint[];
}

export interface DashboardData {
  summary: DashboardSummary;
  charts: DashboardCharts;
  date_range: DateRange;
}

export interface LiveKpis {
  active_services_now: number;
  online_providers: number;
  pending_bookings: number;
  open_disputes: number;
  failed_payments: number;
  refreshed_at: string;
}

export interface BookingAnalytics {
  summary: {
    total_bookings: number;
    completion_rate: number;
    cancellation_rate: number;
    average_service_duration_minutes: number;
    repeat_booking_rate: number;
  };
  by_date: TrendPoint[];
  by_service_type: { service_type: string; count: number }[];
  peak_hours: { hour: number; count: number }[];
  by_status: { status: string; count: number }[];
  date_range: DateRange;
}

export interface BookingHeatmap {
  geographic: { lat: number; lng: number; count: number }[];
  time_heatmap: { day_of_week: number; hour: number; count: number }[];
}

export interface CustomerAnalytics {
  summary: {
    active_customers: number;
    new_registrations: number;
    returning_customers: number;
    retention_rate: number;
    churn_rate: number;
    average_customer_spend: number;
    lifetime_customer_value: number;
    referral_conversions: number;
  };
  top_active_customers: { id: number; name: string; email: string; booking_count: number }[];
  top_profitable_customers: { id: number; name: string; email: string; total_spent: number }[];
  satisfaction_trends: { date: string; avg_rating: number }[];
  date_range: DateRange;
}

export interface CustomerRetention {
  cohorts: {
    cohort_month: string;
    cohort_size: number;
    retained: number;
    retention_rate: number;
  }[];
  inactive_customers: {
    id: number;
    name: string;
    email: string;
    last_booking: string | null;
  }[];
  date_range: DateRange;
}

export interface ProviderAnalytics {
  summary: {
    active_providers: number;
    average_provider_rating: number;
  };
  top_performers: {
    id: number;
    name: string;
    email: string;
    completed_services: number;
    avg_rating: number;
    earnings: number;
  }[];
  low_performers: {
    id: number;
    name: string;
    email: string;
    completed_services: number;
    avg_rating: number;
  }[];
  geographic_distribution: {
    id: number;
    name: string;
    lat: number;
    lng: number;
    status: string;
  }[];
  date_range: DateRange;
}

export interface ProviderComparison {
  providers: {
    id: number;
    name: string;
    revenue: number;
    avg_rating: number;
    service_volume: number;
    completion_rate: number;
    avg_completion_minutes: number;
    complaint_count: number;
  }[];
  date_range: DateRange;
}

export interface SatisfactionAnalytics {
  summary: {
    average_rating: number;
    total_reviews: number;
    satisfaction_rate: number;
    complaint_rate: number;
    refund_percentage: number;
    nps_proxy: number;
  };
  rating_trends: { date: string; avg_rating: number; count: number }[];
  sentiment_breakdown: { sentiment: string; count: number }[];
  common_issues: { report_type: string; count: number }[];
  date_range: DateRange;
}

export interface ExportJob {
  id: number;
  report_type: string;
  export_format: 'csv' | 'xlsx';
  filters: Record<string, unknown> | null;
  generated_file_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  requested_by: number;
  row_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReportQueryParams {
  period?: string;
  from_date?: string;
  to_date?: string;
  service_type?: string;
  status?: string;
  provider_id?: string;
  provider_ids?: string;
  location?: string;
}
