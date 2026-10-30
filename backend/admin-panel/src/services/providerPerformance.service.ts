import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type {
  ProviderPerformanceStats,
  ProviderPerformanceListResponse,
  ProviderPerformanceDetail,
  PerformanceCharts,
  VacuumPenaltyListResponse,
  ReviewListResponse,
  ReviewStats,
  ServiceLimitInfo,
  ThresholdSettings,
  ModerationReview,
  VacuumPenalty,
  ProviderFlag,
} from '@/types/providerPerformance';

export interface PerformanceListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: string;
  min_rating?: string;
  max_rating?: string;
  city?: string;
  state?: string;
}

export const providerPerformanceService = {
  // Dashboard Stats
  getStats: () =>
    api.get<ApiResponse<ProviderPerformanceStats>>('/admin/provider-performance/stats'),

  // Provider Performance List
  list: (params: PerformanceListParams = {}) =>
    api.get<ApiResponse<ProviderPerformanceListResponse>>('/admin/provider-performance', { params }),

  // Provider Performance Detail
  getDetail: (id: number) =>
    api.get<ApiResponse<ProviderPerformanceDetail>>(`/admin/provider-performance/${id}`),

  // Performance Charts
  getCharts: (id: number, period?: string) =>
    api.get<ApiResponse<PerformanceCharts>>(`/admin/provider-performance/${id}/charts`, { params: { period } }),

  // CSV Export
  exportCsv: (params: PerformanceListParams = {}) =>
    api.get('/admin/provider-performance/export', { params, responseType: 'blob' }),

  // Thresholds
  getThresholds: () =>
    api.get<ApiResponse<ThresholdSettings>>('/admin/provider-performance/thresholds'),

  // Run Automated Flagging
  runFlagging: () =>
    api.post<ApiResponse<{ flagged: number }>>('/admin/provider-performance/run-flagging'),

  // Resolve Flag
  resolveFlag: (flagId: number, note?: string) =>
    api.patch<ApiResponse<ProviderFlag>>(`/admin/provider-flags/${flagId}/resolve`, { note }),

  // Manual Flag
  createManualFlag: (providerId: number, data: { flag_type: string; severity?: string; notes?: string }) =>
    api.post<ApiResponse<ProviderFlag>>(`/admin/providers/${providerId}/flag`, data),

  // Vacuum Penalties
  createVacuumPenalty: (providerId: number, data: {
    booking_id?: number;
    penalty_amount: number;
    deduction_type?: string;
    reason: string;
    evidence_urls?: string[];
  }) =>
    api.post<ApiResponse<VacuumPenalty>>(`/admin/providers/${providerId}/vacuum-penalty`, data),

  listVacuumPenalties: (providerId: number, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<VacuumPenaltyListResponse>>(`/admin/providers/${providerId}/vacuum-penalties`, { params }),

  reverseVacuumPenalty: (penaltyId: number) =>
    api.patch<ApiResponse<VacuumPenalty>>(`/admin/vacuum-penalties/${penaltyId}/reverse`),

  // Review Moderation
  getReviewStats: () =>
    api.get<ApiResponse<ReviewStats>>('/admin/reviews/stats'),

  listReviews: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    moderation_status?: string;
    min_rating?: string;
    max_rating?: string;
    sort?: string;
    order?: string;
  }) =>
    api.get<ApiResponse<ReviewListResponse>>('/admin/reviews', { params }),

  updateReviewStatus: (id: number, data: { status: string; reason?: string; moderation_notes?: string }) =>
    api.patch<ApiResponse<ModerationReview>>(`/admin/reviews/${id}/status`, data),

  moderateReviewContent: (id: number, message: string) =>
    api.patch<ApiResponse<ModerationReview>>(`/admin/reviews/${id}/moderate`, { message }),

  // Service Limits
  getServiceLimit: (providerId: number) =>
    api.get<ApiResponse<ServiceLimitInfo>>(`/admin/providers/${providerId}/service-limit`),

  updateServiceLimit: (providerId: number, data: {
    daily_service_limit?: number | null;
    service_limit_enabled?: boolean;
  }) =>
    api.patch<ApiResponse<ServiceLimitInfo>>(`/admin/providers/${providerId}/service-limit`, data),

  // Global Service Limit
  getGlobalServiceLimit: () =>
    api.get<ApiResponse<{ default_daily_limit: number; total_active_providers: number; providers_with_limit_enabled: number; providers_unlimited: number }>>('/admin/service-limits/global'),

  updateGlobalServiceLimit: (data: { default_daily_limit: number; apply_to_all?: boolean }) =>
    api.patch<ApiResponse<{ default_daily_limit: number; apply_to_all: boolean; updated_providers: number }>>('/admin/service-limits/global', data),
};
