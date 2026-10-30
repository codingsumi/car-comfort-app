import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { ReportQueryParams } from '@/types/analytics';
import type {
  SupportDashboardData,
  LiveSupportWidgets,
  SupportTicketListResponse,
  SupportTicketDetailResponse,
  IssueAnalyticsData,
  FaqListResponse,
  FaqCategory,
  FaqRow,
} from '@/types/support';

function mapSupportDateParams(params?: ReportQueryParams) {
  if (!params) return undefined;
  return {
    date_from: params.from_date,
    date_to: params.to_date,
  };
}

export const supportService = {
  getDashboard: (params?: ReportQueryParams) =>
    api.get<ApiResponse<SupportDashboardData>>('/admin/support/analytics', {
      params: mapSupportDateParams(params),
    }),

  getLiveWidgets: () => api.get<ApiResponse<LiveSupportWidgets>>('/admin/support/live'),

  getIssueAnalytics: (params?: ReportQueryParams) =>
    api.get<ApiResponse<IssueAnalyticsData>>('/admin/support/issues', {
      params: mapSupportDateParams(params),
    }),

  listTickets: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<SupportTicketListResponse>>('/admin/support/tickets', { params }),

  getTicket: (id: number, params?: { messages_page?: number; messages_limit?: number }) =>
    api.get<ApiResponse<SupportTicketDetailResponse>>(`/admin/support/tickets/${id}`, { params }),

  replyTicket: (id: number, formData: FormData) =>
    api.post(`/admin/support/tickets/${id}/reply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  replyTicketJson: (id: number, body: { message: string; internal_note?: boolean }) =>
    api.post(`/admin/support/tickets/${id}/reply`, body),

  updateTicket: (id: number, body: Record<string, unknown>) =>
    api.patch(`/admin/support/tickets/${id}/status`, body),

  assignTicket: (id: number, body: { assigned_to?: number | null; strategy?: 'manual' | 'round_robin' | 'priority' }) =>
    api.patch(`/admin/support/tickets/${id}/assign`, body),

  addInternalNote: (id: number, body: { note: string }) =>
    api.post(`/admin/support/tickets/${id}/internal-note`, body),

  escalateTicket: (id: number) => api.post(`/admin/support/tickets/${id}/escalate`),

  notifySupportChat: (id: number, body: { message_id: string; message: string }) =>
    api.post(`/admin/support/tickets/${id}/chat/notify`, body),

  listFaqs: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<FaqListResponse>>('/admin/faq', { params }),

  listFaqCategories: () => api.get<ApiResponse<FaqCategory[]>>('/admin/faq/categories'),

  createFaqCategory: (body: { name: string; slug?: string; sort_order?: number }) =>
    api.post('/admin/faq/categories', body),

  createFaq: (body: {
    category_id: number;
    question: string;
    answer: string;
    status?: string;
    sort_order?: number;
  }) => api.post<ApiResponse<FaqRow>>('/admin/faq', body),

  updateFaq: (
    id: number,
    body: Partial<{ category_id: number; question: string; answer: string; status: string; sort_order: number }>
  ) => api.patch(`/admin/faq/${id}`, body),

  deleteFaq: (id: number) => api.delete(`/admin/faq/${id}`),

  reorderFaqs: (ordered_ids: number[]) => api.patch('/admin/faq/reorder', { ordered_ids }),
};
