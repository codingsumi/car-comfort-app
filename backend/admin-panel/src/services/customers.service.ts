import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface CustomersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  date_from?: string;
  date_to?: string;
  min_bookings?: number;
  max_bookings?: number;
}

export interface CustomerListItem {
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
  profile: Record<string, unknown> | null;
  referral_code: string | null;
  created_at: string;
  total_bookings: number;
  total_spent: string;
}

interface CustomersListResponse {
  customers: CustomerListItem[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface CustomerDetailResponse {
  user: CustomerListItem & {
    auth_type: string;
    stripe_customer_id: string | null;
    suspended_reason: string | null;
    suspended_at: string | null;
    deactivated_at: string | null;
  };
  stats: {
    total_bookings: number;
    status_breakdown: Record<string, number>;
    total_spent: string;
    total_transactions: number;
    succeeded_transactions: number;
    total_vehicles: number;
    total_reviews: number;
    avg_rating: string | null;
    completed_bookings: number;
    completion_rate: string;
  };
  bookings: Array<Record<string, unknown>>;
  vehicles: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
}

export const customersService = {
  list: (params: CustomersListParams = {}) =>
    api.get<ApiResponse<CustomersListResponse>>('/admin/customers', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<CustomerDetailResponse>>(`/admin/customers/${id}`),

  updateStatus: (id: number, data: { status: string; reason?: string }) =>
    api.patch<ApiResponse>(`/admin/customers/${id}/status`, data),

  updateProfile: (id: number, data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    country_code?: string;
  }) => api.patch<ApiResponse<{ user_id: number }>>(`/admin/customers/${id}/profile`, data),

  resetPassword: (
    id: number,
    data: { password?: string; notify_email?: boolean } = {}
  ) =>
    api.post<ApiResponse<{ temp_password: string; email_sent?: boolean; message: string }>>(
      `/admin/customers/${id}/reset-password`,
      data
    ),

  getLoginHistory: (customerId: number) =>
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
    }>>(`/admin/customers/${customerId}/login-history`),
};
