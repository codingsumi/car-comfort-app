import api from '@/lib/api';
import type { ApiResponse } from '@/types';
import type {
  DashboardData,
  LiveKpis,
  BookingAnalytics,
  BookingHeatmap,
  CustomerAnalytics,
  CustomerRetention,
  ProviderAnalytics,
  ProviderComparison,
  SatisfactionAnalytics,
  ExportJob,
  ReportQueryParams,
} from '@/types/analytics';
import type { RevenueReport, RefundReport } from '@/types/finance';

export const reportsService = {
  getDashboard(params?: ReportQueryParams) {
    return api.get<ApiResponse<DashboardData>>('/admin/reports/dashboard', { params });
  },

  getLiveKpis() {
    return api.get<ApiResponse<LiveKpis>>('/admin/reports/kpis');
  },

  getBookingAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<BookingAnalytics>>('/admin/reports/bookings', { params });
  },

  getBookingHeatmap(params?: ReportQueryParams) {
    return api.get<ApiResponse<BookingHeatmap>>('/admin/reports/bookings/heatmap', { params });
  },

  getRevenueAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<RevenueReport>>('/admin/reports/revenue', { params });
  },

  getRefundAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<RefundReport>>('/admin/reports/refunds', { params });
  },

  getCustomerAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<CustomerAnalytics>>('/admin/reports/customers', { params });
  },

  getCustomerRetention(params?: ReportQueryParams) {
    return api.get<ApiResponse<CustomerRetention>>('/admin/reports/customers/retention', { params });
  },

  getProviderAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<ProviderAnalytics>>('/admin/reports/providers', { params });
  },

  getProviderComparison(params?: ReportQueryParams) {
    return api.get<ApiResponse<ProviderComparison>>('/admin/reports/providers/comparison', { params });
  },

  getSatisfactionAnalytics(params?: ReportQueryParams) {
    return api.get<ApiResponse<SatisfactionAnalytics>>('/admin/reports/satisfaction', { params });
  },

  createExport(body: {
    report_type: string;
    export_format?: 'csv' | 'xlsx';
    filters?: ReportQueryParams;
  }) {
    return api.post<ApiResponse<{ job: ExportJob }>>('/admin/reports/export', body);
  },

  getExportJob(id: number) {
    return api.get<ApiResponse<{ job: ExportJob }>>(`/admin/reports/export/${id}`);
  },

  getExportHistory(params?: { page?: number; limit?: number }) {
    return api.get<
      ApiResponse<{
        items: ExportJob[];
        pagination: { page: number; limit: number; total: number; total_pages: number };
      }>
    >('/admin/reports/export/history', { params });
  },
};
