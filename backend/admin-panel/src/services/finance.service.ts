import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types';
import type {
  Transaction,
  TransactionListResponse,
  ProviderPayout,
  PayoutDashboardStats,
  ProviderEarnings,
  PricingRule,
  RevenueReport,
  RefundReport,
  PayoutReport,
  TaxReport,
} from '@/types/finance';

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: string;
  [key: string]: string | number | boolean | undefined;
}

export const financeService = {
  // ─── Transactions ──────────────────────────────────────────────────────
  listTransactions(params: ListParams) {
    return api.get<ApiResponse<TransactionListResponse>>('/admin/finance/transactions', { params });
  },

  getTransaction(id: number) {
    return api.get<ApiResponse<{ transaction: Transaction; refund_history: unknown[] }>>(
      `/admin/finance/transactions/${id}`
    );
  },

  exportTransactionsCsv(params: ListParams) {
    return api.get('/admin/finance/transactions/export', {
      params,
      responseType: 'blob',
    });
  },

  // ─── Payouts ───────────────────────────────────────────────────────────
  getPayoutDashboard() {
    return api.get<ApiResponse<PayoutDashboardStats>>('/admin/finance/payouts/dashboard');
  },

  listPayouts(params: ListParams) {
    return api.get<ApiResponse<PaginatedResponse<ProviderPayout>>>('/admin/finance/payouts', { params });
  },

  getPayoutDetail(id: number) {
    return api.get<ApiResponse<{ payout: ProviderPayout; provider_earnings: ProviderEarnings }>>(
      `/admin/finance/payouts/${id}`
    );
  },

  processManualPayout(data: { provider_id: number; amount: number; notes?: string }) {
    return api.post<ApiResponse<ProviderPayout>>('/admin/finance/payouts/manual', data);
  },

  getProviderEarnings(providerId: number) {
    return api.get<ApiResponse<ProviderEarnings>>(`/admin/finance/providers/${providerId}/earnings`);
  },

  // ─── Pricing ───────────────────────────────────────────────────────────
  listPricingRules(params: ListParams) {
    return api.get<ApiResponse<PaginatedResponse<PricingRule>>>('/admin/pricing', { params });
  },

  createPricingRule(data: Partial<PricingRule>) {
    return api.post<ApiResponse<PricingRule>>('/admin/pricing', data);
  },

  updatePricingRule(id: number, data: Partial<PricingRule>) {
    return api.patch<ApiResponse<PricingRule>>(`/admin/pricing/${id}`, data);
  },

  deletePricingRule(id: number) {
    return api.delete<ApiResponse<void>>(`/admin/pricing/${id}`);
  },

  // ─── Refunds ───────────────────────────────────────────────────────────
  listRefundHistory(params: ListParams) {
    return api.get<ApiResponse<unknown>>('/admin/finance/refunds', { params });
  },

  // ─── Reports ───────────────────────────────────────────────────────────
  getRevenueReport(params: ListParams) {
    return api.get<ApiResponse<RevenueReport>>('/admin/finance/reports/revenue', { params });
  },

  getRefundReport(params: ListParams) {
    return api.get<ApiResponse<RefundReport>>('/admin/finance/reports/refunds', { params });
  },

  getPayoutReport(params: ListParams) {
    return api.get<ApiResponse<PayoutReport>>('/admin/finance/reports/payouts', { params });
  },

  getTaxReport(params: ListParams) {
    return api.get<ApiResponse<TaxReport>>('/admin/finance/reports/taxes', { params });
  },

  exportReport(type: string, params: ListParams) {
    return api.get('/admin/finance/reports/export', {
      params: { ...params, type },
      responseType: 'blob',
    });
  },
};
