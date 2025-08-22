import { apiClient } from '@/lib/axios';
import type {
  SaleTransaction,
  SaleTransactionWithLines,
  CreateSaleRequest,
  CreateSaleResponse,
  SaleFilters,
  SaleListResponse,
  SalesStats,
  SalesDashboardData
} from '@/types/sales';

const API_BASE = '/transactions';

export const salesApi = {
  /**
   * Create a new sale transaction
   * POST /transactions/sales/new
   */
  createNewSale: async (data: CreateSaleRequest): Promise<CreateSaleResponse> => {
    const response = await apiClient.post(`${API_BASE}/sales/new`, data);
    
    // Handle both direct response and wrapped response formats
    if (response.data.success !== undefined) {
      return response.data;
    }
    
    // If the response doesn't have success field, wrap it
    return {
      success: true,
      message: 'Sale transaction created successfully',
      transaction_id: response.data.id,
      transaction_number: response.data.transaction_number,
      data: response.data
    };
  },

  /**
   * List sales transactions with optional filtering
   * GET /transactions/sales/
   */
  listTransactions: async (filters?: SaleFilters): Promise<SaleListResponse> => {
    const params = new URLSearchParams();
    
    // Add filters as query parameters
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.customer_id) params.append('customer_id', filters.customer_id);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.search) params.append('search', filters.search);

    const response = await apiClient.get(`${API_BASE}/sales?${params.toString()}`);
    
    // Handle array response (direct list) or paginated response
    if (Array.isArray(response.data)) {
      return {
        items: response.data,
        total: response.data.length,
        skip: filters?.skip || 0,
        limit: filters?.limit || 100
      };
    }
    
    // Handle paginated response
    return response.data;
  },

  /**
   * Get sale transaction details by ID
   * GET /transactions/sales/{transaction_id}
   */
  getTransactionDetails: async (transactionId: string): Promise<SaleTransaction> => {
    const response = await apiClient.get(`${API_BASE}/sales/${transactionId}`);
    return response.data;
  },

  /**
   * Get sale transaction by transaction number
   * GET /transactions/sales/number/{transaction_number}
   */
  getTransactionByNumber: async (transactionNumber: string): Promise<SaleTransaction> => {
    const response = await apiClient.get(`${API_BASE}/sales/number/${transactionNumber}`);
    return response.data;
  },

  /**
   * Get sale transaction with all line items (same as getTransactionDetails for our new API)
   * GET /transactions/sales/{transaction_id}
   */
  getTransactionWithLines: async (transactionId: string): Promise<SaleTransactionWithLines> => {
    const response = await apiClient.get(`${API_BASE}/sales/${transactionId}`);
    return response.data;
  },

  /**
   * Get sales statistics for dashboard
   * GET /transactions/sales/stats/summary
   */
  getSalesStats: async (dateRange?: { from: string; to: string }): Promise<SalesStats> => {
    const params = new URLSearchParams();
    if (dateRange?.from) params.append('date_from', dateRange.from);
    if (dateRange?.to) params.append('date_to', dateRange.to);
    
    try {
      const response = await apiClient.get(`${API_BASE}/sales/stats/summary?${params.toString()}`);
      return response.data;
    } catch {
      // Return default stats if endpoint doesn't exist
      return {
        today_sales: 0,
        monthly_sales: 0,
        total_transactions: 0,
        average_sale_amount: 0
      };
    }
  },

  /**
   * Get dashboard data including stats and recent sales
   * GET /transactions/sales/dashboard/data
   */
  getDashboardData: async (): Promise<SalesDashboardData> => {
    try {
      // Get comprehensive dashboard data from new endpoint
      const response = await apiClient.get(`${API_BASE}/sales/dashboard/data`);
      return response.data.data; // Extract data from wrapper
    } catch (error) {
      console.error('Failed to get sales dashboard data:', error);
      // Fallback: get individual pieces of data
      const [stats, recentSales] = await Promise.all([
        salesApi.getSalesStats(),
        salesApi.listTransactions({ 
          transaction_type: 'SALE', 
          limit: 5, 
          skip: 0 
        })
      ]);

      return {
        stats,
        recent_sales: recentSales.data || [],
        top_selling_items: []
      };
    }
  },

  /**
   * Cancel a sale transaction
   * PATCH /transactions/sales/{transaction_id}/status
   */
  cancelTransaction: async (transactionId: string, reason?: string): Promise<SaleTransaction> => {
    const response = await apiClient.patch(`${API_BASE}/sales/${transactionId}/status`, {
      status: 'CANCELLED',
      notes: reason || 'Transaction cancelled'
    });
    return response.data;
  },

  /**
   * Process refund for a sale transaction
   * POST /transactions/sales/{transaction_id}/refund
   */
  refundTransaction: async (transactionId: string, amount?: number, reason?: string): Promise<SaleTransaction> => {
    const response = await apiClient.post(`${API_BASE}/sales/${transactionId}/refund`, {
      refund_amount: amount,
      reason: reason || 'Transaction refunded'
    });
    return response.data;
  },

  /**
   * Search for saleable items with stock availability
   * GET /transactions/sales/saleable-items
   */
  searchSaleableItems: async (
    query: string, 
    limit = 20,
    options?: {
      category_id?: string;
      brand_id?: string;
      location_id?: string;
      in_stock_only?: boolean;
    }
  ) => {
    try {
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      params.append('limit', limit.toString());
      params.append('skip', '0');
      
      // Add optional filters
      if (options?.category_id) params.append('category_id', options.category_id);
      if (options?.brand_id) params.append('brand_id', options.brand_id);
      if (options?.location_id) params.append('location_id', options.location_id);
      if (options?.in_stock_only !== undefined) {
        params.append('in_stock_only', options.in_stock_only.toString());
      } else {
        params.append('in_stock_only', 'true'); // Default to in-stock items only
      }
      
      const response = await apiClient.get(`${API_BASE}/sales/sales/saleable-items?${params.toString()}`);
      
      // Handle the response based on the new schema
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      // Fallback for direct data response
      return response.data || [];
    } catch (error) {
      console.error('Error searching saleable items:', error);
      return [];
    }
  },

  /**
   * Check item availability for sale
   * GET /transactions/sales/items/{item_id}/availability
   */
  checkItemAvailability: async (itemId: string, quantity: number, locationId?: string) => {
    try {
      const params = new URLSearchParams();
      params.append('quantity', quantity.toString());
      if (locationId) params.append('location_id', locationId);
      
      const response = await apiClient.get(`${API_BASE}/sales/items/${itemId}/availability?${params.toString()}`);
      
      return {
        available: response.data.is_available || false,
        current_available: response.data.available_stock || 0,
        requested: quantity
      };
    } catch (error) {
      console.error('Error checking item availability:', error);
      return {
        available: false,
        current_available: 0,
        requested: quantity
      };
    }
  }
};

export default salesApi;