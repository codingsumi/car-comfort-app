export type NotificationChannel = 'push' | 'email' | 'in_app';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type TemplateType = 'booking' | 'promotional' | 'payment' | 'refund' | 'provider' | 'support';
export type AudienceSegment =
  | 'all_customers'
  | 'all_providers'
  | 'specific_users'
  | 'custom';

export interface AudienceFilters {
  segment: AudienceSegment;
  user_ids?: number[];
  role?: string;
  user_status?: 'active' | 'inactive';
  city?: string;
  state?: string;
  has_booking_days?: number;
  service_type?: string;
}

export interface NotificationDashboardSummary {
  sentToday: number;
  pushDeliveryRate: number;
  openRate: number;
  failedToday: number;
  scheduledCampaigns: number;
  activeCampaigns: number;
  emailSuccessRate: number;
}

export interface NotificationCampaign {
  id: number;
  campaign_name: string;
  notification_type: string;
  title: string;
  message: string;
  image_url: string | null;
  deep_link_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  channels: NotificationChannel[];
  audience_filters: AudienceFilters;
  delivery_stats: {
    audience_size?: number;
    sent?: number;
    failed?: number;
    skipped?: number;
    opened?: number;
    clicked?: number;
    batches_total?: number;
    batches_done?: number;
  } | null;
  status: CampaignStatus;
  timezone: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  recurring_rule: Record<string, unknown> | null;
  template_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string; email: string };
}

export interface NotificationTemplate {
  id: number;
  template_name: string;
  template_type: TemplateType;
  title_template: string;
  body_template: string;
  variables: string[] | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string };
}

export interface NotificationDeliveryLog {
  id: number;
  campaign_id: number | null;
  notification_id: number | null;
  recipient_id: number;
  channel: NotificationChannel | string;
  delivery_status: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  created_at: string;
  recipient?: { id: number; name: string; email: string; role: string };
  campaign?: { id: number; campaign_name: string };
}

export interface NotificationDashboardData {
  summary: NotificationDashboardSummary;
  recentCampaigns: NotificationCampaign[];
  failedDeliveries: NotificationDeliveryLog[];
  recentlyOpened: NotificationDeliveryLog[];
  scheduledNotifications: NotificationCampaign[];
}

export interface NotificationAnalytics {
  summary: {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    failed: number;
  };
  dailySends: { date: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  byStatus: { delivery_status: string; count: number }[];
  deviceBreakdown: { platform: string; count: number }[];
  topCampaigns?: {
    id: number;
    campaign_name: string;
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
    open_rate: number;
    click_rate: number;
    sent_at: string | null;
  }[];
  bySegment?: { segment: string; count: number }[];
}

export interface SendNotificationPayload {
  campaign_name?: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  audience_filters?: AudienceFilters;
  segment?: AudienceSegment;
  notification_type?: string;
  image_url?: string;
  deep_link_url?: string;
  cta_text?: string;
  cta_url?: string;
  scheduled_at?: string;
  timezone?: string;
  template_id?: number;
}
