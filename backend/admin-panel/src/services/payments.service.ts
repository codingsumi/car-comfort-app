import api from '@/lib/api';
import type { ApiResponse, BookingTransaction, PaginatedResponse } from '@/types';

export interface PaymentsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const paymentsService = {
  list: (params: PaymentsListParams = {}) =>
    api.get<ApiResponse<PaginatedResponse<BookingTransaction>>>('/admin/payments', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<BookingTransaction>>(`/admin/payments/${id}`),

  refund: (id: number, amount?: number) =>
    api.post<ApiResponse>(`/admin/payments/${id}/refund`, { amount }),
};
