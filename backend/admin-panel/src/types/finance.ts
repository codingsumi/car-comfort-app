import type { User, Booking, BookingTransaction, RefundRequest } from './index';

export type TransactionType =
  | 'booking_payment'
  | 'refund'
  | 'partial_refund'
  | 'provider_payout'
  | 'adjustment'
  | 'manual_payout'
  | 'commission_deduction';

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PayoutStatus = 'pending' | 'scheduled' | 'paid' | 'failed' | 'cancelled';

export type PricingServiceType =
  | 'car_wash'
  | 'ev_charging'
  | 'combo'
  | 'add_on'
  | 'convenience_fee'
  | 'cancellation_fee';

export type PricingLocationType = 'default' | 'country' | 'state' | 'county' | 'city';

export interface Transaction {
  id: number;
  transaction_code: string;
  booking_id: number | null;
  booking_transaction_id: number | null;
  customer_id: number | null;
  provider_id: number | null;
  transaction_type: TransactionType;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  amount: string;
  commission_amount: string;
  provider_earning: string;
  tax_amount: string;
  refund_amount: string;
  net_amount: string;
  status: TransactionStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  customer?: User;
  provider?: User;
  booking?: Booking;
  booking_transaction?: BookingTransaction & {
    refund_requests?: RefundRequest[];
  };
}

export interface TransactionStats {
  total_count: number;
  total_revenue: number;
  total_refunds: number;
  total_commission: number;
  net_revenue: number;
}

export interface TransactionListResponse {
  rows: Transaction[];
  count: number;
  totalPages: number;
  currentPage: number;
  stats: TransactionStats;
}

export interface ProviderPayout {
  id: number;
  provider_id: number;
  stripe_transfer_id: string | null;
  stripe_destination_account: string | null;
  gross_amount: string;
  commission_deducted: string;
  vacuum_fee_deducted: string;
  refund_adjustments: string;
  tax_deducted: string;
  net_amount: string;
  status: PayoutStatus;
  notes: string | null;
  processed_by: number | null;
  processed_at: string | null;
  failure_reason: string | null;
  service_count: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
  provider?: User & { stripe_connect_account_id?: string };
  processor?: { id: number; name: string };
}

export interface PayoutDashboardStats {
  total_pending: number;
  total_paid: number;
  total_failed: number;
  total_upcoming: number;
  platform_revenue: number;
}

export interface ProviderEarnings {
  total_earnings: number;
  commission_deducted: number;
  tax_deducted: number;
  refund_adjustments: number;
  gross_earning: number;
  total_paid: number;
  available_balance: number;
  service_count: number;
}

export interface PricingRule {
  id: number;
  service_type: PricingServiceType;
  location_type: PricingLocationType;
  country: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
  base_price: string;
  surge_multiplier: string;
  surge_enabled: boolean;
  tax_percentage: string;
  commission_percentage: string;
  provider_earning_percentage: string;
  peak_hour_multiplier: string | null;
  peak_hour_start: string | null;
  peak_hour_end: string | null;
  weekend_multiplier: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string };
  updater?: { id: number; name: string };
}

export interface TrendDataPoint {
  date: string;
  revenue?: number;
  refunds?: number;
  amount?: number;
  count: number;
}

export interface RevenueReportSummary {
  gross_revenue: number;
  net_revenue: number;
  commission_earned: number;
  taxes_collected: number;
  total_refunds: number;
  pending_payouts: number;
  paid_payouts: number;
  total_bookings: number;
}

export interface RevenueReport {
  summary: RevenueReportSummary;
  trend: TrendDataPoint[];
  by_service_type?: {
    service_type: string;
    revenue: number;
    refunds: number;
    count: number;
  }[];
}

export interface RefundReportSummary {
  total_refunded: number;
  total_requests: number;
}

export interface RefundReport {
  summary: RefundReportSummary;
  by_status: { status: string; count: number; total: number }[];
  trend: TrendDataPoint[];
}

export interface PayoutReport {
  summary: {
    total_paid: number;
    total_commission: number;
    total_payouts: number;
  };
  by_status: { status: string; count: number; total: number }[];
  trend: TrendDataPoint[];
}

export interface TaxReport {
  summary: {
    total_tax: number;
    total_bookings: number;
  };
  by_service_type: {
    service_type: string;
    tax_collected: number;
    revenue: number;
    count: number;
  }[];
}
