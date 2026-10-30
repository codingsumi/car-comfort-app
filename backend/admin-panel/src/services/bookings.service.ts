import api from '@/lib/api';
import type {
  ApiResponse,
  Booking,
  BookingDashboardStats,
  BookingDetailResponse,
  BookingDispute,
  BookingDisputeStats,
  FleetMapBooking,
  PaginatedResponse,
  RefundRequest,
} from '@/types';

export interface BookingsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment_status?: string;
  service_type?: string;
  from_date?: string;
  to_date?: string;
  customer_id?: number;
  provider_id?: number;
  city?: string;
  amount_min?: number;
  amount_max?: number;
  include_abandoned?: boolean;
  include_archived?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const bookingsService = {
  // Dashboard stats
  getStats: () =>
    api.get<ApiResponse<BookingDashboardStats>>('/admin/bookings/stats'),

  // Booking list
  list: (params: BookingsListParams = {}) =>
    api.get<ApiResponse<PaginatedResponse<Booking>>>('/admin/bookings', { params }),

  // Booking detail
  getById: (id: number) =>
    api.get<ApiResponse<BookingDetailResponse>>(`/admin/bookings/${id}`),

  // Restricted server-side to unpaid, non-operational test bookings.
  deleteTestBooking: (id: number) =>
    api.delete<ApiResponse<{ booking_id: number }>>(`/admin/bookings/${id}/test`),

  archiveTestBooking: (id: number, archived = true) =>
    api.patch<ApiResponse<{ booking_id: number; archived: boolean }>>(`/admin/bookings/${id}/test-archive`, { archived }),

  exportRecord: async (id: number) => {
    const res = await api.get(`/admin/bookings/${id}/export.pdf`, { responseType: 'blob' });
    return res.data as Blob;
  },

  // Cancel booking
  cancel: (id: number, reason: string) =>
    api.patch<ApiResponse>(`/admin/bookings/${id}/cancel`, { reason }),

  // Update booking status
  updateStatus: (id: number, status: string) =>
    api.patch<ApiResponse>(`/admin/bookings/${id}/status`, { status }),

  // Get provider location for active booking
  getProviderLocation: (bookingId: number) =>
    api.get<ApiResponse<{ lat: string; lng: string; created_at: string } | null>>(`/admin/bookings/${bookingId}/location`),

  // Disputes
  createDispute: (bookingId: number, data: { customer_complaint?: string; admin_notes?: string }) =>
    api.post<ApiResponse<BookingDispute>>(`/admin/bookings/${bookingId}/dispute`, data),

  getDisputeStats: () =>
    api.get<ApiResponse<BookingDisputeStats>>('/admin/disputes/stats'),

  listDisputes: (params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    from_date?: string;
    to_date?: string;
  } = {}) =>
    api.get<ApiResponse<PaginatedResponse<BookingDispute>>>('/admin/disputes', { params }),

  getDispute: (disputeId: number) =>
    api.get<ApiResponse<BookingDispute>>(`/admin/disputes/${disputeId}`),

  resolveDispute: (disputeId: number, data: { status: string; admin_notes?: string; restore_status?: string }) =>
    api.patch<ApiResponse<BookingDispute>>(`/admin/disputes/${disputeId}/resolve`, data),

  // Refunds
  processRefund: (bookingId: number, data: { amount: number; reason: string }) =>
    api.post<ApiResponse<RefundRequest>>(`/admin/bookings/${bookingId}/refund`, data),

  listRefunds: (params: { page?: number; limit?: number; status?: string; booking_id?: number } = {}) =>
    api.get<ApiResponse<PaginatedResponse<RefundRequest>>>('/admin/refunds', { params }),

  // Fleet map — all bookings with optional filters
  getFleetMap: (params?: import('@/types').FleetMapFilters) =>
    api.get<ApiResponse<{ bookings: FleetMapBooking[]; total: number; active: number; page: number; totalPages: number }>>('/admin/bookings/fleet-map', { params }),

  // Edit booking (ops control)
  // Unassigned bookings (confirmed with no provider) for admin job dispatch
  listUnassigned: (params: { page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<{
      bookings: Array<{
        id: number;
        booking_code: string | null;
        status: string;
        service_type: string | null;
        scheduled_at: string | null;
        address: string | null;
        total_price: string | null;
        user: { id: number; name: string | null; email: string } | null;
        assigned_driver_user_id: number | null;
        assigned_driver: { id: number; name: string | null; email: string } | null;
        created_at: string;
      }>;
      pagination: { total: number; page: number; limit: number; total_pages: number };
    }>>('/admin/bookings', {
      params: { status: 'confirmed', unassigned: true, ...params },
    }),

  editBooking: (bookingId: number, data: {
    scheduled_at?: string | null;
    service_address?: string | null;
    assigned_driver_user_id?: number | null;
    notes?: string | null;
  }) =>
    api.patch<ApiResponse<{ booking_id: number; status: string; changes: Record<string, unknown>; updated_fields: string[] }>>(
      `/admin/bookings/${bookingId}/edit`,
      data
    ),

  // Service duration report
  listServiceDurationReport: (params: {
    page?: number;
    limit?: number;
    search?: string;
    from_date?: string;
    to_date?: string;
    provider_id?: number;
  } = {}) =>
    api.get<ApiResponse<{
      records: Array<{
        id: number;
        booking_code: string;
        service_type: string;
        service_started_at: string | null;
        service_completed_at: string | null;
        service_duration_minutes: number | null;
        address: string | null;
        service_address: string | null;
        ev_charging_address: string | null;
        service_location_name: string | null;
        total_price: string | null;
        assigned_driver_user_id: number | null;
        assigned_driver: { id: number; name: string | null; first_name: string | null; last_name: string | null; email: string } | null;
        user: { id: number; name: string | null; first_name: string | null; last_name: string | null; email: string } | null;
        created_at: string;
      }>;
      pagination: { total: number; page: number; limit: number; total_pages: number };
    }>>('/admin/bookings/service-duration-report', { params }),
};
