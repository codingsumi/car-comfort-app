import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type { AdminVehicleType } from '@/types/vehicleTypes';

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: string;
  status?: string;
}

export const vehicleTypesService = {
  list(params: ListParams = {}) {
    return api.get<ApiResponse<PaginatedResponse<AdminVehicleType>>>('/admin/vehicle-types', { params });
  },

  listAll(params?: { status?: string }) {
    return api.get<ApiResponse<AdminVehicleType[]>>('/admin/vehicle-types', {
      params: { all: 'true', ...params },
    });
  },

  listActiveOptions() {
    return vehicleTypesService.listAll({ status: 'active' });
  },

  create(data: { name: string; status?: string; charges: number | string }) {
    return api.post<ApiResponse<AdminVehicleType>>('/admin/vehicle-types', data);
  },

  update(id: number, data: Partial<{ name: string; status: string; charges: number | string }>) {
    return api.patch<ApiResponse<AdminVehicleType>>(`/admin/vehicle-types/${id}`, data);
  },

  remove(id: number) {
    return api.delete<ApiResponse<{ id: number }>>(`/admin/vehicle-types/${id}`);
  },
};
