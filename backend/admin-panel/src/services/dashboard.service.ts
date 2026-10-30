import api from '@/lib/api';
import type { ApiResponse, DashboardStats } from '@/types';

export const dashboardService = {
  getStats: () =>
    api.get<ApiResponse<DashboardStats>>('/admin/dashboard/stats'),
};
