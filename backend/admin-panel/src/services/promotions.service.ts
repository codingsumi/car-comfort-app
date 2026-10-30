import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface PromotionalDiscount {
  id: number;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'flat';
  discount_value: string | number;
  applicable_services: string[] | null;
  audience: 'all' | 'new_customers';
  recurrence: 'one_time' | 'weekly' | 'monthly';
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'inactive' | 'scheduled' | 'expired';
  max_uses: number | null;
  uses_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionFormData {
  name: string;
  description?: string;
  discount_type: 'percentage' | 'flat';
  discount_value: string | number;
  applicable_services?: string[] | null;
  audience: 'all' | 'new_customers';
  recurrence: 'one_time' | 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
  status?: string;
  max_uses?: number | string | null;
  notify_customers?: boolean;
}

interface ListParams {
  page?: number;
  limit?: number;
  status?: string;
}

interface ListResponse {
  total: number;
  page: number;
  limit: number;
  data: PromotionalDiscount[];
}

export const promotionsService = {
  list(params: ListParams) {
    return api
      .get<ApiResponse<void> & ListResponse>('/admin/promotions', { params })
      .then((r) => r.data);
  },

  get(id: number) {
    return api
      .get<ApiResponse<PromotionalDiscount>>(`/admin/promotions/${id}`)
      .then((r) => r.data);
  },

  create(data: PromotionFormData) {
    return api
      .post<ApiResponse<PromotionalDiscount>>('/admin/promotions', data)
      .then((r) => r.data);
  },

  update(id: number, data: Partial<PromotionFormData>) {
    return api
      .patch<ApiResponse<PromotionalDiscount>>(`/admin/promotions/${id}`, data)
      .then((r) => r.data);
  },

  toggle(id: number) {
    return api
      .post<ApiResponse<PromotionalDiscount>>(`/admin/promotions/${id}/toggle`)
      .then((r) => r.data);
  },

  delete(id: number) {
    return api
      .delete<ApiResponse<void>>(`/admin/promotions/${id}`)
      .then((r) => r.data);
  },

  notify(id: number) {
    return api
      .post<ApiResponse<void> & { message: string; audience_size: number; campaign_id: number }>(
        `/admin/promotions/${id}/notify`
      )
      .then((r) => r.data);
  },
};
