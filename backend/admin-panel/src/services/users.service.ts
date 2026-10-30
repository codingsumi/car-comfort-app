import api from '@/lib/api';
import type { ApiResponse, UserDetailResponse } from '@/types';

export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  /** `all` searches customers, providers, and garage users (excludes admin). */
  type?: 'customer' | 'driver' | 'garage' | 'admin' | 'all';
  sort?: string;
  order?: 'asc' | 'desc';
}

interface UsersListResponse {
  users: UserDetailResponse['user'][];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export const usersService = {
  list: (params: UsersListParams = {}) => {
    const queryParams = { ...params };
    if (queryParams.role && !queryParams.type) {
      queryParams.type = queryParams.role as UsersListParams['type'];
    }
    if (!queryParams.type) {
      queryParams.type = 'customer';
    }
    return api.get<ApiResponse<UsersListResponse>>('/admin/users', { params: queryParams });
  },

  /** Search users by name, email, or phone (for notification audience picker). */
  search: (search: string, limit = 12) =>
    api.get<ApiResponse<UsersListResponse>>('/admin/users', {
      params: { type: 'all', search, limit, page: 1 },
    }),

  getById: (id: number) =>
    api.get<ApiResponse<UserDetailResponse>>(`/admin/users/${id}`),

  delete: (id: number) =>
    api.delete<ApiResponse>(`/admin/users/${id}`),

  createAdmin: (data: { name: string; email: string; phone?: string; password: string }) =>
    api.post<ApiResponse<{ id: number; name: string; email: string }>>('/admin/users/admin', data),

  updateAdmin: (id: number, data: { name?: string; phone?: string; status?: string; suspended_reason?: string }) =>
    api.patch<ApiResponse>(`/admin/users/${id}/admin`, data),
};
