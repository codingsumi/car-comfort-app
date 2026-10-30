import api from '@/lib/api';
import type { ApiResponse, DriverProfile, PaginatedResponse } from '@/types';

export interface DriversListParams {
  page?: number;
  limit?: number;
  search?: string;
  approval_status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const driversService = {
  list: (params: DriversListParams = {}) =>
    api.get<ApiResponse<PaginatedResponse<DriverProfile>>>('/admin/drivers', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<DriverProfile>>(`/admin/drivers/${id}`),

  approve: (userId: number) =>
    api.post<ApiResponse>(`/admin/drivers/${userId}/approve`),

  reject: (userId: number, reason?: string) =>
    api.post<ApiResponse>(`/admin/drivers/${userId}/reject`, { reason }),
};
