import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export type LegalPageAudience = 'customer' | 'provider' | 'common';

export interface LegalPage {
  id: number;
  title: string;
  slug: string;
  audience: LegalPageAudience;
  description_json: { html: string; support_email?: string; pdf_url?: string };
  meta_title: string | null;
  meta_description: string | null;
  status: boolean;
  sort_order: number;
  requires_agreement: boolean;
  show_in_menu: boolean;
  created_at: string;
  updated_at: string;
}

export interface LegalPagePayload {
  title: string;
  slug?: string;
  audience: LegalPageAudience;
  description_json: { html: string; pdf_url?: string; support_email?: string };
  meta_title?: string;
  meta_description?: string;
  status?: boolean;
  sort_order?: number;
  requires_agreement?: boolean;
  show_in_menu?: boolean;
}

export interface LegalPagesListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  audience?: LegalPageAudience;
}

export interface LegalPagesListResult {
  rows: LegalPage[];
  count: number;
  totalPages: number;
  currentPage: number;
}

function mapListResponse(data: {
  legal_pages?: LegalPage[];
  pagination?: { total?: number; page?: number; total_pages?: number };
}): LegalPagesListResult {
  const rows = data.legal_pages ?? [];
  const pagination = data.pagination ?? {};
  return {
    rows,
    count: pagination.total ?? rows.length,
    totalPages: pagination.total_pages ?? 1,
    currentPage: pagination.page ?? 1,
  };
}

export const legalPagesService = {
  list: async (params: LegalPagesListParams = {}) => {
    const res = await api.get<ApiResponse<{
      legal_pages: LegalPage[];
      pagination: { total: number; page: number; total_pages: number };
    }>>('/admin/legal-pages', { params });
    return mapListResponse(res.data.data);
  },

  getById: (id: number) =>
    api.get<ApiResponse<LegalPage>>(`/admin/legal-pages/${id}`),

  create: (data: LegalPagePayload) =>
    api.post<ApiResponse<LegalPage>>('/admin/legal-pages', data),

  update: (id: number, data: Partial<LegalPagePayload>) =>
    api.patch<ApiResponse<LegalPage>>(`/admin/legal-pages/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse>(`/admin/legal-pages/${id}`),

  reorder: (body: { audience: LegalPageAudience; ordered_ids: number[] }) =>
    api.patch<ApiResponse<{ updated: number; audience: LegalPageAudience }>>(
      '/admin/legal-pages/reorder',
      body
    ),

  uploadPdf: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('pdf', file);
    const res = await api.post<ApiResponse<{ url: string; filename: string }>>(
      '/admin/legal-pages/upload-pdf',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },
};
