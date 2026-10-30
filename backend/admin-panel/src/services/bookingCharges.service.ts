import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type { BookingCharge, BookingChargePayload, CreateBookingChargePayload } from '@/types/bookingCharges';

export const bookingChargesService = {
  list() {
    return api.get<ApiResponse<BookingCharge[]>>('/admin/booking-charges');
  },

  create(data: CreateBookingChargePayload) {
    return api.post<ApiResponse<BookingCharge>>('/admin/booking-charges', data);
  },

  update(id: number, data: Partial<BookingChargePayload>) {
    return api.patch<ApiResponse<BookingCharge>>(`/admin/booking-charges/${id}`, data);
  },

  delete(id: number) {
    return api.delete<ApiResponse<{ id: number }>>(`/admin/booking-charges/${id}`);
  },
};
