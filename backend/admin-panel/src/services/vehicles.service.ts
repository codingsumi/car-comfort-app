import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Vehicle,
  VehicleFlag,
  VehiclesSummary,
} from '@/types';

export interface VehiclesListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  make?: string;
  vehicle_type?: string;
  year_from?: number;
  year_to?: number;
  status?: string;
  flagged_only?: boolean | string;
  date_from?: string;
  date_to?: string;
  format?: 'csv';
}

export const VEHICLE_FLAG_TYPES = [
  { value: 'fake_registration', label: 'Fake registration' },
  { value: 'duplicate_vehicle', label: 'Duplicate vehicle' },
  { value: 'suspicious_activity', label: 'Suspicious activity' },
  { value: 'invalid_license_plate', label: 'Invalid license plate' },
  { value: 'possible_duplicate', label: 'Possible duplicate (auto)' },
] as const;

export const vehiclesService = {
  getSummary: () =>
    api.get<ApiResponse<VehiclesSummary>>('/admin/vehicles/summary'),

  list: (params: VehiclesListParams = {}) =>
    api.get<ApiResponse<PaginatedResponse<Vehicle>>>('/admin/vehicles', { params }),

  exportCsv: (params: Omit<VehiclesListParams, 'format'> = {}) =>
    api.get('/admin/vehicles', {
      params: { ...params, format: 'csv', limit: 2000 },
      responseType: 'blob',
    }),

  getById: (
    id: number,
    params?: { bookings_page?: number; bookings_limit?: number; booking_status?: string }
  ) =>
    api.get<ApiResponse<{ vehicle: Vehicle }>>(`/admin/vehicles/${id}`, { params }),

  updateStatus: (id: number, body: { status: string; notes?: string }) =>
    api.patch<ApiResponse<Vehicle>>(`/admin/vehicles/${id}/status`, body),

  remove: (id: number, reason: string) =>
    api.delete<ApiResponse<{ id: number }>>(`/admin/vehicles/${id}`, { data: { reason } }),

  deleteImage: (vehicleId: number, imageId: number) =>
    api.delete(`/admin/vehicles/${vehicleId}/images/${imageId}`),

  flagImage: (vehicleId: number, imageId: number, is_flagged: boolean) =>
    api.patch(`/admin/vehicles/${vehicleId}/images/${imageId}/flag`, { is_flagged }),

  createFlag: (
    vehicleId: number,
    body: { flag_type: string; reason?: string; review_status?: string }
  ) => api.post<ApiResponse<VehicleFlag>>(`/admin/vehicles/${vehicleId}/flag`, body),

  unflag: (vehicleId: number, body?: { resolution_notes?: string }) =>
    api.post<ApiResponse<{ vehicle_id: number; flags_cleared: number; status: string }>>(
      `/admin/vehicles/${vehicleId}/unflag`,
      body ?? {}
    ),

  updateFlag: (
    flagId: number,
    body: { review_status?: string; resolution_notes?: string }
  ) => api.patch<ApiResponse<VehicleFlag>>(`/admin/vehicles/flags/${flagId}`, body),

  listFlagged: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<PaginatedResponse<VehicleFlag>>>('/admin/vehicles/flagged', { params }),
};
