import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export type AccountDeletionStatus = 'otp_pending' | 'pending' | 'approved' | 'rejected';

export interface AccountDeletionRequestItem {
  id: number;
  user_id: number | null;
  role: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  reason: string | null;
  source: 'app' | 'public';
  status: AccountDeletionStatus;
  processed_by: number | null;
  processed_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
  } | null;
  processor?: {
    id: number;
    name: string | null;
    email: string | null;
  } | null;
}

interface AccountDeletionListResponse {
  requests: AccountDeletionRequestItem[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface AccountDeletionListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
}

export interface AccountDeletionStats {
  total: number;
  otp_pending: number;
  pending: number;
  approved: number;
  rejected: number;
}

export const accountDeletionRequestsService = {
  stats: () =>
    api.get<ApiResponse<AccountDeletionStats>>('/admin/account-deletion-requests/stats'),

  list: (params: AccountDeletionListParams = {}) =>
    api.get<ApiResponse<AccountDeletionListResponse>>('/admin/account-deletion-requests', { params }),

  approve: (id: number, adminNote?: string) =>
    api.patch<ApiResponse>(`/admin/account-deletion-requests/${id}/approve`, {
      admin_note: adminNote?.trim() || undefined,
    }),

  reject: (id: number, adminNote: string) =>
    api.patch<ApiResponse>(`/admin/account-deletion-requests/${id}/reject`, {
      admin_note: adminNote.trim(),
    }),

  sendPublicOtp: (data: { name?: string; email: string }) =>
    api.post<ApiResponse>('/account-deletion-requests/public/send-otp', data),

  submitPublic: (data: { name: string; email: string; otp: string; reason: string }) =>
    api.post<ApiResponse>('/account-deletion-requests/public/submit', data),
};
