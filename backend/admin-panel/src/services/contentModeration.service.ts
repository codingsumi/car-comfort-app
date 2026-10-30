import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type {
  ModerationDashboardData,
  ModerationReviewDetailResponse,
  ModerationReviewListResponse,
  ModerationLogsResponse,
  PlatformReportDetailResponse,
  PlatformReportListResponse,
  SupportTicketDetailResponse,
  SupportTicketListResponse,
  FaqListResponse,
  FaqCategory,
} from '@/types/contentModeration';

export const contentModerationService = {
  getDashboard: (params?: { date_from?: string; date_to?: string }) =>
    api.get<ApiResponse<ModerationDashboardData>>('/admin/moderation/dashboard', { params }),

  listReviews: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<ModerationReviewListResponse>>('/admin/moderation/reviews', { params }),

  getReview: (id: number) =>
    api.get<ApiResponse<ModerationReviewDetailResponse>>(`/admin/moderation/reviews/${id}`),

  updateReviewStatus: (id: number, body: { status: string; reason?: string; moderation_notes?: string }) =>
    api.patch(`/admin/moderation/reviews/${id}/status`, body),

  editReview: (id: number, message: string) =>
    api.patch(`/admin/moderation/reviews/${id}/edit`, { message }),

  listReports: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<PlatformReportListResponse>>('/admin/reports', { params }),

  getReport: (id: number) => api.get<ApiResponse<PlatformReportDetailResponse>>(`/admin/reports/${id}`),

  updateReport: (id: number, body: Record<string, unknown>) => api.patch(`/admin/reports/${id}/status`, body),

  addReportNote: (id: number, body: { note: string; is_internal?: boolean }) =>
    api.post(`/admin/reports/${id}/notes`, body),

  listSupportTickets: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<SupportTicketListResponse>>('/admin/support/tickets', { params }),

  getSupportTicket: (id: number, params?: { messages_page?: number; messages_limit?: number }) =>
    api.get<ApiResponse<SupportTicketDetailResponse>>(`/admin/support/tickets/${id}`, { params }),

  replySupportTicket: (id: number, formData: FormData) =>
    api.post(`/admin/support/tickets/${id}/reply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  replySupportTicketJson: (id: number, body: { message: string; internal_note?: boolean }) =>
    api.post(`/admin/support/tickets/${id}/reply`, body),

  updateSupportTicket: (id: number, body: Record<string, unknown>) =>
    api.patch(`/admin/support/tickets/${id}/status`, body),

  listFaqCategories: () => api.get<ApiResponse<FaqCategory[]>>('/admin/faqs/categories'),

  createFaqCategory: (body: { name: string; slug?: string; sort_order?: number }) =>
    api.post('/admin/faqs/categories', body),

  listFaqs: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<FaqListResponse>>('/admin/faqs', { params }),

  createFaq: (body: {
    category_id: number;
    question: string;
    answer: string;
    status?: string;
    sort_order?: number;
  }) => api.post('/admin/faqs', body),

  updateFaq: (
    id: number,
    body: Partial<{ category_id: number; question: string; answer: string; status: string; sort_order: number }>
  ) => api.patch(`/admin/faqs/${id}`, body),

  deleteFaq: (id: number) => api.delete(`/admin/faqs/${id}`),

  listModerationLogs: (params?: Record<string, string | number | undefined>) =>
    api.get<ApiResponse<ModerationLogsResponse>>('/admin/moderation/logs', { params }),

  sendEmailToCustomer: (body: {
    to_email: string;
    to_name?: string;
    subject: string;
    message: string;
    ticket_id?: number;
  }) => api.post('/admin/support/email', body),

  listEmailHistory: (params?: Record<string, string | number | undefined>) =>
    api.get('/admin/support/email-history', { params }),

  respondToReview: (id: number, response: string) =>
    api.post(`/admin/moderation/reviews/${id}/respond`, { response }),

  deleteReviewResponse: (id: number) =>
    api.delete(`/admin/moderation/reviews/${id}/respond`),
};
