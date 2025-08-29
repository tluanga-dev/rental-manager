/**
 * API service for Stock Levels management
 */
import { apiClient } from '@/lib/axios';

export interface StockLevel {
  id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  location_id: string;
  location_name: string;
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  quantity_on_rent: number;
  quantity_in_maintenance: number;
  quantity_damaged: number;
  reorder_point: number | null;
  maximum_stock: number | null;
  total_value: number;
  last_updated: string;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  category?: {
    id: string;
    name: string;
    code: string;
  };
  brand?: {
    id: string;
    name: string;
  };
}

export interface StockSummary {
  total_on_hand: number;
  total_available: number;
  total_reserved: number;
  total_on_rent: number;
  total_damaged: number;
  total_value: number;
  location_count: number;
  item_count: number;
  low_stock_count: number;
  utilization_rate: number;
  availability_rate: number;
}

export interface LowStockAlert {
  id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  reorder_point: number;
  shortage: number;
  severity: 'high' | 'medium' | 'low';
  alert_type: 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface StockAdjustmentRequest {
  item_id: string;
  location_id: string;
  adjustment_type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  reason: string;
  notes?: string;
  cost_per_unit?: number;
}

export interface StockTransferRequest {
  item_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
  transfer_notes?: string;
  requires_approval?: boolean;
}

export interface GetStockLevelsParams {
  search?: string;
  location_id?: string;
  item_id?: string;
  category_id?: string;
  brand_id?: string;
  stock_status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export const stockLevelsApi = {
  /**
   * Get all stock levels with filtering
   */
  async getStockLevels(params?: GetStockLevelsParams): Promise<{data: StockLevel[], total: number}> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const response = await apiClient.get<{success: boolean; data: StockLevel[]; total: number}>(
      `/inventory/stock-levels?${queryParams.toString()}`
    );
    
    if (response.data.success) {
      return {
        data: response.data.data || [],
        total: response.data.total || 0
      };
    }
    
    return { data: [], total: 0 };
  },

  /**
   * Get stock summary statistics
   */
  async getStockSummary(location_id?: string): Promise<StockSummary> {
    const params = location_id ? `?location_id=${location_id}` : '';
    const response = await apiClient.get<{success: boolean; data: StockSummary}>(
      `/inventory/stock-levels/summary${params}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    // Return default summary if no data
    return {
      total_on_hand: 0,
      total_available: 0,
      total_reserved: 0,
      total_on_rent: 0,
      total_damaged: 0,
      total_value: 0,
      location_count: 0,
      item_count: 0,
      low_stock_count: 0,
      utilization_rate: 0,
      availability_rate: 0,
    };
  },

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    const response = await apiClient.get<{success: boolean; data: LowStockAlert[]}>(
      '/inventory/stock-levels/alerts'
    );
    
    if (response.data.success) {
      return response.data.data || [];
    }
    
    return [];
  },

  /**
   * Get specific stock level for item and location
   */
  async getStockLevel(item_id: string, location_id: string): Promise<StockLevel | null> {
    try {
      const response = await apiClient.get<{success: boolean; data: StockLevel}>(
        `/inventory/stock-levels/${item_id}/${location_id}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error(`Error fetching stock level for item ${item_id} at location ${location_id}:`, error);
    }
    
    return null;
  },

  /**
   * Initialize stock level for item at location
   */
  async initializeStockLevel(data: {
    item_id: string;
    location_id: string;
    initial_quantity?: number;
    reorder_point?: number;
    maximum_stock?: number;
  }): Promise<StockLevel> {
    const response = await apiClient.post<{success: boolean; data: StockLevel}>(
      '/inventory/stock-levels/initialize',
      data
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Failed to initialize stock level');
  },

  /**
   * Perform stock adjustment
   */
  async adjustStock(adjustment: StockAdjustmentRequest): Promise<StockLevel> {
    const response = await apiClient.post<{success: boolean; data: StockLevel}>(
      '/inventory/stock-levels/adjust',
      adjustment
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Failed to adjust stock');
  },

  /**
   * Transfer stock between locations
   */
  async transferStock(transfer: StockTransferRequest): Promise<{success: boolean; message: string}> {
    const response = await apiClient.post<{success: boolean; message: string; data?: any}>(
      '/inventory/stock-levels/transfer',
      transfer
    );
    
    return {
      success: response.data.success,
      message: response.data.message || 'Transfer completed'
    };
  },

  /**
   * Update stock level settings (reorder point, max stock)
   */
  async updateStockLevel(stock_level_id: string, data: {
    reorder_point?: number;
    maximum_stock?: number;
  }): Promise<StockLevel> {
    const response = await apiClient.put<{success: boolean; data: StockLevel}>(
      `/inventory/stock-levels/${stock_level_id}`,
      data
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Failed to update stock level');
  },

  /**
   * Check availability for rental/sale
   */
  async checkAvailability(data: {
    item_id: string;
    location_id?: string;
    quantity: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{available: boolean; available_quantity: number; message?: string}> {
    const response = await apiClient.get<{success: boolean; data: any}>(
      `/inventory/stock-levels/availability/check?${new URLSearchParams(
        Object.entries(data).filter(([_, value]) => value !== undefined).map(([key, value]) => [key, String(value)])
      ).toString()}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return {
      available: false,
      available_quantity: 0,
      message: 'Unable to check availability'
    };
  }
};