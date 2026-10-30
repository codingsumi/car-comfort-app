import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type {
  ActivityLogDetail,
  ActivityLogListResponse,
  AlertListResponse,
  ComplianceListResponse,
  ComplianceRequestRow,
  LiveSecurityWidgets,
  SecurityDashboardData,
  SessionListResponse,
} from '@/types/security';

export const securityService = {
  getDashboard: (params?: Record<string, string | undefined>) =>
    api.get<ApiResponse<SecurityDashboardData>>('/admin/security/analytics', { params }),

  getLiveWidgets: () => api.get<ApiResponse<LiveSecurityWidgets>>('/admin/security/live'),

  listLogs: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<ActivityLogListResponse>>('/admin/security/logs', { params }),

  getLog: (id: number | string) =>
    api.get<ApiResponse<ActivityLogDetail>>(`/admin/security/logs/${id}`),

  exportLogsCsv: (params?: Record<string, string | number | undefined>) =>
    api.get('/admin/security/logs', { params: { ...params, format: 'csv' }, responseType: 'blob' }),

  listSessions: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<SessionListResponse>>('/admin/security/sessions', { params }),

  revokeSession: (id: number | string) =>
    api.post<ApiResponse<unknown>>(`/admin/security/sessions/${id}/revoke`),

  forceLogoutSession: (id: number | string) =>
    api.post<ApiResponse<unknown>>(`/admin/security/sessions/${id}/force-logout`),

  listCompliance: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<ComplianceListResponse>>('/admin/security/compliance', { params }),

  createComplianceRequest: (body: {
    user_id: number;
    request_type: string;
    deletion_type?: string;
    notes?: string;
  }) => api.post<ApiResponse<ComplianceRequestRow>>('/admin/security/compliance', body),

  processCompliance: (
    id: number | string,
    body: { action: string; deletion_type?: string; notes?: string }
  ) => api.post<ApiResponse<ComplianceRequestRow>>(`/admin/security/compliance/${id}/process`, body),

  exportUserData: (userId: number) =>
    api.post<ApiResponse<{ export_url: string }>>('/admin/security/export-user-data', { user_id: userId }),

  listAlerts: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<AlertListResponse>>('/admin/security/alerts', { params }),

  updateAlertStatus: (id: number | string, status: string) =>
    api.patch<ApiResponse<unknown>>(`/admin/security/alerts/${id}/status`, { status }),

  getAdminSecurityOverview: () =>
    api.get<ApiResponse<unknown>>('/admin/security/admin-overview'),

  getDataRetentionSettings: () =>
    api.get<ApiResponse<{ audit_logs_days: number; support_tickets_days: number; notifications_days: number; user_data_days: number }>>('/admin/security/data-retention'),

  updateDataRetentionSettings: (data: { audit_logs_days: number; support_tickets_days: number; notifications_days: number; user_data_days: number }) =>
    api.patch<ApiResponse<unknown>>('/admin/security/data-retention', data),

  getAlertNotificationSettings: () =>
    api.get<ApiResponse<{ email: string; enabled: boolean; min_severity: string }>>('/admin/security/alert-notifications'),

  updateAlertNotificationSettings: (data: { email: string; enabled: boolean; min_severity: string }) =>
    api.patch<ApiResponse<unknown>>('/admin/security/alert-notifications', data),
};
