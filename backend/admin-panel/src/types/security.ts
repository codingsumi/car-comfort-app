export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'investigating' | 'resolved';
export type ComplianceRequestType = 'account_deletion' | 'data_export' | 'data_anonymization' | 'consent_update';
export type ComplianceRequestStatus = 'pending' | 'verified' | 'processing' | 'completed' | 'rejected';
export type DeletionType = 'soft_delete' | 'permanent_delete' | 'anonymization';

export interface SecurityAdminRef {
  id: number;
  name: string;
  email?: string;
}

export interface ActivityLogRow {
  id: number;
  admin?: SecurityAdminRef;
  actor_type: string;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  module: string | null;
  severity: AuditSeverity;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

export interface ActivityLogDetail extends ActivityLogRow {
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  api_endpoint: string | null;
  request_metadata: Record<string, unknown> | null;
  related_entities: unknown;
}

export interface AdminSessionRow {
  id: number;
  admin?: SecurityAdminRef;
  ip_address: string | null;
  device_info: string | null;
  login_at: string;
  last_activity_at: string;
  is_revoked: boolean;
  status: 'active' | 'revoked';
}

export interface ComplianceRequestRow {
  id: number;
  user_id: number;
  request_type: ComplianceRequestType;
  request_status: ComplianceRequestStatus;
  deletion_type: DeletionType | null;
  notes: string | null;
  export_url: string | null;
  processed_at: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    role: string;
    status: string;
  };
  processor?: SecurityAdminRef;
}

export interface SecurityAlertRow {
  id: number;
  alert_type: string;
  severity: AlertSeverity;
  entity_type: string | null;
  entity_id: number | null;
  status: AlertStatus;
  recommended_action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolver?: SecurityAdminRef;
}

export interface SecurityDashboardData {
  summary: {
    total_admin_users: number;
    active_admin_sessions: number;
    failed_login_attempts_24h: number;
    suspicious_activities: number;
    pending_compliance_requests: number;
    account_deletion_requests: number;
    recent_password_resets_24h: number;
  };
  live: {
    active_admins: Array<{
      session_id: number;
      admin?: SecurityAdminRef;
      ip_address: string | null;
      login_at: string;
      last_activity_at: string;
    }>;
    recent_logins: AuthEventRow[];
    failed_auth_attempts: AuthEventRow[];
    recent_sensitive_actions: ActivityLogRow[];
    security_alerts: SecurityAlertRow[];
  };
  recent_critical_actions: ActivityLogRow[];
}

export interface AuthEventRow {
  id: number;
  event_type: string;
  ip_address: string | null;
  email_attempt: string | null;
  created_at: string;
  user?: SecurityAdminRef;
}

export interface LiveSecurityWidgets {
  active_admin_sessions: number;
  failed_login_attempts_24h: number;
  open_security_alerts: number;
  critical_alerts: number;
  pending_compliance_requests: number;
}

export interface PaginatedResponse<T> {
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export type ActivityLogListResponse = PaginatedResponse<never> & { logs: ActivityLogRow[] };
export type SessionListResponse = PaginatedResponse<never> & { sessions: AdminSessionRow[] };
export type ComplianceListResponse = PaginatedResponse<never> & { requests: ComplianceRequestRow[] };
export type AlertListResponse = PaginatedResponse<never> & { alerts: SecurityAlertRow[] };

export const AUDIT_SEVERITIES: AuditSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
export const ALERT_STATUSES: AlertStatus[] = ['open', 'investigating', 'resolved'];
export const COMPLIANCE_TYPES: ComplianceRequestType[] = [
  'account_deletion',
  'data_export',
  'data_anonymization',
  'consent_update',
];
export const COMPLIANCE_STATUSES: ComplianceRequestStatus[] = [
  'pending',
  'verified',
  'processing',
  'completed',
  'rejected',
];
export const DELETION_TYPES: DeletionType[] = ['soft_delete', 'permanent_delete', 'anonymization'];

export const MODULE_OPTIONS = [
  'auth',
  'finance',
  'bookings',
  'users',
  'compliance',
  'support',
  'moderation',
  'vehicles',
  'notifications',
  'security',
  'general',
];
