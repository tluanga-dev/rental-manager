/**
 * API service for Stock Movements
 */
import { apiClient } from '@/lib/axios';

export interface StockMovement {
  id: string;
  movement_type: 'PURCHASE' | 'SALE' | 'RENTAL_OUT' | 'RENTAL_RETURN' | 'TRANSFER' | 'ADJUSTMENT' | 'DAMAGE' | 'REPAIR' | 'WRITE_OFF';
  item_id: string;
  item_name?: string;
  item_sku?: string;
  location_id: string;
  location_name?: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_number?: string;
  notes?: string;
  transaction_id?: string;
  created_by_id?: string;
  created_by_name?: string;
  created_at: string;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
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

export interface MovementTypeStats {
  movement_type: string;
  count: number;
  total_quantity: number;
  total_value: number;
}

export interface MovementSummary {
  total_movements: number;
  total_quantity_in: number;
  total_quantity_out: number;
  total_value_in: number;
  total_value_out: number;
  net_quantity: number;
  net_value: number;
  movement_types: MovementTypeStats[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export interface GetMovementsParams {
  search?: string;
  item_id?: string;
  location_id?: string;
  movement_type?: string;
  transaction_id?: string;
  created_by?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export const stockMovementsApi = {
  /**
   * Get stock movements with filtering
   */
  async getMovements(params?: GetMovementsParams): Promise<{data: StockMovement[], total: number}> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const response = await apiClient.get<{success: boolean; data: StockMovement[]; total: number}>(
      `/inventory/movements?${queryParams.toString()}`
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
   * Get movement summary statistics
   */
  async getMovementSummary(params?: {
    item_id?: string;
    location_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<MovementSummary> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const response = await apiClient.get<{success: boolean; data: MovementSummary}>(
        `/inventory/movements/summary?${queryParams.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching movement summary:', error);
    }
    
    // Return default summary
    return {
      total_movements: 0,
      total_quantity_in: 0,
      total_quantity_out: 0,
      total_value_in: 0,
      total_value_out: 0,
      net_quantity: 0,
      net_value: 0,
      movement_types: [],
      date_range: {
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      },
    };
  },

  /**
   * Get movement type statistics
   */
  async getMovementStatistics(): Promise<MovementTypeStats[]> {
    try {
      const response = await apiClient.get<{success: boolean; data: MovementTypeStats[]}>(
        '/inventory/movements/statistics'
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching movement statistics:', error);
    }
    
    return [];
  },

  /**
   * Get specific movement by ID
   */
  async getMovement(movement_id: string): Promise<StockMovement | null> {
    try {
      const response = await apiClient.get<{success: boolean; data: StockMovement}>(
        `/inventory/movements/${movement_id}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error(`Error fetching movement ${movement_id}:`, error);
    }
    
    return null;
  },

  /**
   * Get movements for a specific item
   */
  async getItemMovements(
    item_id: string, 
    params?: { limit?: number; start_date?: string; end_date?: string }
  ): Promise<StockMovement[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('item_id', item_id);
      
      if (params?.limit) {
        queryParams.append('limit', String(params.limit));
      }
      if (params?.start_date) {
        queryParams.append('start_date', params.start_date);
      }
      if (params?.end_date) {
        queryParams.append('end_date', params.end_date);
      }
      
      const response = await apiClient.get<{success: boolean; data: StockMovement[]}>(
        `/inventory/movements/item/${item_id}/history?${queryParams.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error(`Error fetching movements for item ${item_id}:`, error);
    }
    
    return [];
  },

  /**
   * Get movements for a specific location
   */
  async getLocationMovements(
    location_id: string,
    params?: { limit?: number; start_date?: string; end_date?: string }
  ): Promise<StockMovement[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.limit) {
        queryParams.append('limit', String(params.limit));
      }
      if (params?.start_date) {
        queryParams.append('start_date', params.start_date);
      }
      if (params?.end_date) {
        queryParams.append('end_date', params.end_date);
      }
      
      const response = await apiClient.get<{success: boolean; data: StockMovement[]}>(
        `/inventory/movements/location/${location_id}/history?${queryParams.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error(`Error fetching movements for location ${location_id}:`, error);
    }
    
    return [];
  },

  /**
   * Get recent movements
   */
  async getRecentMovements(limit: number = 20): Promise<StockMovement[]> {
    try {
      const response = await apiClient.get<{success: boolean; data: StockMovement[]}>(
        `/inventory/movements/recent?limit=${limit}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching recent movements:', error);
    }
    
    return [];
  },

  /**
   * Export movements to CSV
   */
  async exportMovements(params?: GetMovementsParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const response = await apiClient.get(
      `/inventory/movements/export?${queryParams.toString()}`,
      { responseType: 'blob' }
    );
    
    return response.data;
  },
};