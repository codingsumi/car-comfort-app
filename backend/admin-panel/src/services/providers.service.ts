import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface ProvidersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  approval_status?: string;
  insurance_verified?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  min_services?: number;
  max_services?: number;
}

export interface ProviderListItem {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  country_code: string | null;
  role: string;
  status: 'active' | 'suspended' | 'deactivated';
  is_verified: boolean;
  created_at: string;
  total_services: number;
  total_earnings: string;
  avg_rating: string | null;
  total_reviews: number;
  driver_profile: {
    id: number;
    user_id: number;
    profile_picture: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    approval_reason: string | null;
    approved_at: string | null;
    approved_by: number | null;
    rejected_at: string | null;
    insurance_verified: boolean;
    is_completed: boolean;
    current_step: number;
    step_data: Record<string, unknown> | null;
  } | null;
}

interface ProvidersListResponse {
  providers: ProviderListItem[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface ProviderDetailResponse {
  user: ProviderListItem & {
    auth_type: string;
    suspended_reason: string | null;
    suspended_at: string | null;
    deactivated_at: string | null;
    vehicles: Array<Record<string, unknown>>;
  };
  stats: {
    total_bookings: number;
    status_breakdown: Record<string, number>;
    completed_bookings: number;
    total_earnings: string;
    total_reviews: number;
    avg_rating: string | null;
    completion_rate: string;
  };
  bookings: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  audit_logs: Array<Record<string, unknown>>;
}

export const providersService = {
  list: (params: ProvidersListParams = {}) =>
    api.get<ApiResponse<ProvidersListResponse>>('/admin/providers', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<ProviderDetailResponse>>(`/admin/providers/${id}`),

  updateStatus: (id: number, data: { status: string; reason?: string }) =>
    api.patch<ApiResponse>(`/admin/providers/${id}/status`, data),

  approve: (id: number) =>
    api.patch<ApiResponse>(`/admin/providers/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.patch<ApiResponse>(`/admin/providers/${id}/reject`, { reason }),

  updateInsuranceStatus: (id: number, insurance_verified: boolean) =>
    api.patch<ApiResponse>(`/admin/providers/${id}/insurance-status`, { insurance_verified }),

  resetPassword: (
    id: number,
    data: { password?: string; notify_email?: boolean } = {}
  ) =>
    api.post<ApiResponse<{ temp_password: string; email_sent?: boolean; message: string }>>(
      `/admin/providers/${id}/reset-password`,
      data
    ),

  updateProfile: (providerId: number, data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    country_code?: string;
    date_of_birth?: string;
    address?: string;
    social_security_number?: string;
    drivers_license_number?: string;
    drivers_license_issued_date?: string;
    drivers_license_expiration_date?: string;
  }) =>
    api.patch<ApiResponse<{ user_id: number }>>(`/admin/providers/${providerId}/profile`, data),

  uploadProfilePhoto: async (providerId: number, file: File) => {
    const form = new FormData();
    form.append('profile_photo', file);
    return api.post<ApiResponse<{ user_id: number; profile_picture: string }>>(
      `/admin/providers/${providerId}/profile-photo`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  downloadProfilePhoto: async (providerId: number) => {
    const res = await api.get(`/admin/providers/${providerId}/profile-photo/download`, {
      responseType: 'blob',
    });
    const blob = res.data as Blob;
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/tiff': 'tiff',
      'image/heic': 'heic',
      'image/avif': 'avif',
    };
    return {
      blob,
      extension: extensionByType[blob.type.toLowerCase()] || 'img',
    };
  },

  getLoginHistory: (providerId: number) =>
    api.get<ApiResponse<{
      login_history: Array<{
        id: number;
        platform: string | null;
        device_model: string | null;
        app_version: string | null;
        is_active: boolean;
        last_login_at: string | null;
        last_login_ip: string | null;
        registered_at: string | null;
      }>;
    }>>(`/admin/providers/${providerId}/login-history`),

  downloadServiceRecord: async (providerId: number, bookingId: number) => {
    const res = await api.get(
      `/admin/providers/${providerId}/bookings/${bookingId}/service-record.pdf`,
      { responseType: 'blob' }
    );
    return res.data as Blob;
  },
};
