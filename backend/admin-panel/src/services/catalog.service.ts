import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type { AdminPackage, AdminService } from '@/types/catalog';

interface ListPackagesParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: string;
  service_type?: string;
  is_active?: string;
}

export const catalogService = {
  listServices() {
    return api.get<ApiResponse<AdminService[]>>('/admin/services');
  },

  patchService(id: number, data: { icon?: string | null }) {
    return api.patch<ApiResponse<AdminService>>(`/admin/services/${id}`, data);
  },

  listPackages(params: ListPackagesParams) {
    return api.get<ApiResponse<PaginatedResponse<AdminPackage>>>('/admin/packages', { params });
  },

  createPackage(data: Partial<AdminPackage> & { package_name: string; price: number | string; service_type: string }) {
    return api.post<ApiResponse<AdminPackage>>('/admin/packages', data);
  },

  updatePackage(id: number, data: Partial<AdminPackage>) {
    return api.patch<ApiResponse<AdminPackage>>(`/admin/packages/${id}`, data);
  },

  deletePackage(id: number) {
    return api.delete<ApiResponse<{ id: number }>>(`/admin/packages/${id}`);
  },
};
