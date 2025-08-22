import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

/**
 * Financial Analytics API Types
 */
export interface FinancialSummary {
  total_revenue: number;
  total_transactions: number;
  avg_transaction_value: number;
  outstanding_amount: number;
  outstanding_count: number;
  active_rental_value: number;
  active_rental_count: number;
}

export interface RevenueByType {
  transaction_type: string;
  revenue: number;
  count: number;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  transaction_count: number;
}

export interface PeriodComparison {
  current_period: {
    revenue: number;
    transactions: number;
    avg_value: number;
    customers: number;
  };
  previous_period: {
    revenue: number;
    transactions: number;
    avg_value: number;
    customers: number;
  };
  changes: {
    revenue_change: number;
    transactions_change: number;
    avg_value_change: number;
    customers_change: number;
  };
}

export interface FinancialDashboardData {
  summary: FinancialSummary;
  revenue_by_type: RevenueByType[];
  monthly_revenue: MonthlyRevenue[];
  period_comparison?: PeriodComparison;
}

export interface RevenueTrend {
  revenue: number;
  transaction_count: number;
  avg_transaction_value: number;
  year?: number;
  month?: number;
  day?: number;
  week?: number;
}

export interface CashFlowSummary {
  total_inflows: number;
  total_outflows: number;
  net_cash_flow: number;
}

export interface CashFlowByType {
  transaction_type: string;
  amount: number;
  count: number;
}

export interface MonthlyCashFlow {
  year: number;
  month: number;
  transaction_type: string;
  amount: number;
}

export interface CashFlowData {
  summary: CashFlowSummary;
  inflows_by_type: CashFlowByType[];
  outflows_by_type: CashFlowByType[];
  monthly_cashflow: MonthlyCashFlow[];
}

export interface FinancialAnalyticsParams {
  start_date?: string;
  end_date?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

export interface OverdueCustomer {
  customer_id: string;
  customer_name: string;
  outstanding_amount: number;
  days_overdue: number;
}

export interface ReceivablesAgingData {
  aging_summary: AgingBucket[];
  total_outstanding: number;
  overdue_customers: OverdueCustomer[];
}

export interface RentalUtilizationData {
  utilization: {
    total_items: number;
    rented_items: number;
    available_items: number;
    utilization_rate: number;
  };
  performance: {
    total_rentals: number;
    avg_rental_value: number;
    late_rentals: number;
    late_return_rate: number;
  };
}

export interface CustomerLifetimeValueData {
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    lifetime_value: number;
    transaction_count: number;
    avg_transaction: number;
    customer_since: string | null;
    last_active: string | null;
  }>;
  summary: {
    total_customers: number;
    avg_lifetime_value: number;
  };
}

/**
 * Financial Analytics API Service
 * Provides comprehensive financial analytics and business intelligence
 */
export const financialAnalyticsApi = {
  /**
   * Get comprehensive financial dashboard summary
   */
  getFinancialDashboard: async (
    params?: Pick<FinancialAnalyticsParams, 'start_date' | 'end_date'>
  ): Promise<FinancialDashboardData> => {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const url = `/analytics/financial/dashboard${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<FinancialDashboardData>>(url);
    return response.data.data;
  },

  /**
   * Get revenue trends over time with configurable periods
   */
  getRevenueTrends: async (
    params?: FinancialAnalyticsParams
  ): Promise<RevenueTrend[]> => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append('period', params.period);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const url = `/analytics/financial/revenue-trends${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<RevenueTrend[]>>(url);
    return response.data.data;
  },

  /**
   * Get cash flow analysis with inflows and outflows
   */
  getCashFlowAnalysis: async (
    params?: Pick<FinancialAnalyticsParams, 'start_date' | 'end_date'>
  ): Promise<CashFlowData> => {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const url = `/analytics/financial/cash-flow${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<CashFlowData>>(url);
    return response.data.data;
  },

  /**
   * Get receivables aging analysis
   */
  getReceivablesAging: async (): Promise<ReceivablesAgingData> => {
    const response = await apiClient.get<ApiResponse<ReceivablesAgingData>>(
      '/analytics/financial/receivables-aging'
    );
    return response.data.data;
  },

  /**
   * Get rental utilization metrics
   */
  getRentalUtilization: async (
    params?: Pick<FinancialAnalyticsParams, 'start_date' | 'end_date'>
  ): Promise<RentalUtilizationData> => {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const url = `/analytics/rental/utilization${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await apiClient.get<ApiResponse<RentalUtilizationData>>(url);
    return response.data.data;
  },

  /**
   * Get customer lifetime value analysis
   */
  getCustomerLifetimeValue: async (limit: number = 10): Promise<CustomerLifetimeValueData> => {
    const response = await apiClient.get<ApiResponse<CustomerLifetimeValueData>>(
      `/analytics/customer/lifetime-value?limit=${limit}`
    );
    return response.data.data;
  },
};