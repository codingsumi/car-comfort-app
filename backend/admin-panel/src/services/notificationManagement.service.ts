import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';
import type {
  NotificationAnalytics,
  NotificationCampaign,
  NotificationDashboardData,
  NotificationDeliveryLog,
  NotificationTemplate,
  SendNotificationPayload,
  AudienceFilters,
} from '@/types/notificationManagement';

export const notificationManagementService = {
  getDashboard: () =>
    api.get<{ data: NotificationDashboardData }>('/admin/notifications/overview').then((r) => r.data.data),

  send: (payload: SendNotificationPayload) =>
    api.post('/admin/notifications/send', payload).then((r) => r.data.data),

  estimateAudience: (filters: AudienceFilters) =>
    api
      .post<{ data: { count: number } }>('/admin/notifications/estimate-audience', {
        audience_filters: filters,
      })
      .then((r) => r.data.data),

  getCampaign: (id: number) =>
    api.get<{ data: NotificationCampaign }>(`/admin/notifications/${id}`).then((r) => r.data.data),

  listCampaigns: (params?: Record<string, unknown>) =>
    api
      .get<{ data: PaginatedResponse<NotificationCampaign> }>('/admin/notifications/campaigns', { params })
      .then((r) => r.data.data),

  createCampaign: (payload: Partial<NotificationCampaign> & SendNotificationPayload) =>
    api.post('/admin/notifications/campaigns', payload).then((r) => r.data.data),

  updateCampaign: (id: number, payload: Record<string, unknown>) =>
    api.patch(`/admin/notifications/campaigns/${id}`, payload).then((r) => r.data.data),

  cancelCampaign: (id: number) =>
    api.delete(`/admin/notifications/campaigns/${id}`).then((r) => r.data.data),

  duplicateCampaign: (id: number) =>
    api.post(`/admin/notifications/campaigns/${id}/duplicate`).then((r) => r.data.data),

  retryCampaign: (id: number) =>
    api.post(`/admin/notifications/campaigns/${id}/retry`).then((r) => r.data.data),

  listTemplates: (params?: Record<string, unknown>) =>
    api
      .get<{ data: NotificationTemplate[] }>('/admin/notifications/templates', { params })
      .then((r) => r.data.data),

  createTemplate: (payload: Partial<NotificationTemplate>) =>
    api.post('/admin/notifications/templates', payload).then((r) => r.data.data),

  updateTemplate: (id: number, payload: Partial<NotificationTemplate>) =>
    api.patch(`/admin/notifications/templates/${id}`, payload).then((r) => r.data.data),

  deleteTemplate: (id: number) => api.delete(`/admin/notifications/templates/${id}`),

  getAnalytics: (params?: Record<string, unknown>) =>
    api
      .get<{ data: NotificationAnalytics }>('/admin/notifications/analytics', { params })
      .then((r) => r.data.data),

  exportAnalytics: (params?: Record<string, unknown>) =>
    api.get('/admin/notifications/analytics/export', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    }),

  listLogs: (params?: Record<string, unknown>) =>
    api
      .get<{ data: PaginatedResponse<NotificationDeliveryLog> }>('/admin/notifications/logs', { params })
      .then((r) => r.data.data),
};
