/**
 * API service for Inventory Items feature
 */
import { apiClient } from '@/lib/axios';
import type {
  InventoryItemSummary,
  InventoryItemDetail,
  InventoryUnitDetail,
  StockMovementDetail,
  InventoryAnalytics,
  GetInventoryItemsParams,
  GetInventoryUnitsParams,
  GetMovementsParams,
  AllInventoryLocation,
  GetAllInventoryParams,
} from '@/types/inventory-items';

const BASE_PATH = '/inventory/items';

export const inventoryItemsApi = {
  /**
   * Get all inventory items with stock summary
   */
  async getItems(params?: GetInventoryItemsParams): Promise<InventoryItemSummary[]> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const response = await apiClient.get<InventoryItemSummary[] | any>(
      `${BASE_PATH}?${queryParams.toString()}`
    );
    // Handle both array and object responses
    const data = response.data;
    
    // If data is an array, return it directly
    if (Array.isArray(data)) {
      return data;
    }
    
    // If data is an object with a 'data' property that's an array
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
      return data.data;
    }
    
    // If data is an object with an 'items' property that's an array
    if (data && typeof data === 'object' && Array.isArray(data.items)) {
      return data.items;
    }
    
    // Default to empty array
    console.warn('Unexpected response format from inventory items API:', data);
    return [];
  },

  /**
   * Get detailed information for a specific inventory item
   */
  async getItemDetail(itemId: string): Promise<InventoryItemDetail> {
    try {
      const response = await apiClient.get<InventoryItemDetail>(
        `${BASE_PATH}/${itemId}`
      );
      
      // Handle both direct data and wrapped responses
      const data = response.data;
      
      // If response is wrapped in a data object
      if (data && typeof data === 'object' && 'data' in data) {
        return (data as any).data;
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching item detail for ${itemId}:`, error);
      throw error;
    }
  },

  /**
   * Get all inventory units for a specific item
   */
  async getItemUnits(
    itemId: string, 
    params?: GetInventoryUnitsParams
  ): Promise<InventoryUnitDetail[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const response = await apiClient.get<InventoryUnitDetail[]>(
        `${BASE_PATH}/${itemId}/units?${queryParams.toString()}`
      );
      
      // Handle both direct array and wrapped responses
      const data = response.data;
      
      // If data is an array, return it directly
      if (Array.isArray(data)) {
        return data;
      }
      
      // If data is wrapped in a data object
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        return (data as any).data;
      }
      
      // Default to empty array for units (item might not be serialized)
      console.warn('Unexpected response format from inventory units API:', data);
      return [];
    } catch (error) {
      console.error(`Error fetching units for item ${itemId}:`, error);
      return []; // Return empty array instead of throwing for units
    }
  },

  /**
   * Get stock movement history for a specific item
   */
  async getItemMovements(
    itemId: string,
    params?: GetMovementsParams
  ): Promise<StockMovementDetail[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const response = await apiClient.get<StockMovementDetail[]>(
        `${BASE_PATH}/${itemId}/movements?${queryParams.toString()}`
      );
      
      // Handle both direct array and wrapped responses
      const data = response.data;
      
      // If data is an array, return it directly
      if (Array.isArray(data)) {
        return data;
      }
      
      // If data is wrapped in a data object
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        return (data as any).data;
      }
      
      // Default to empty array for movements
      console.warn('Unexpected response format from inventory movements API:', data);
      return [];
    } catch (error) {
      console.error(`Error fetching movements for item ${itemId}:`, error);
      return []; // Return empty array instead of throwing for movements
    }
  },

  /**
   * Get analytics data for a specific inventory item
   */
  async getItemAnalytics(itemId: string): Promise<InventoryAnalytics> {
    try {
      const response = await apiClient.get<InventoryAnalytics>(
        `${BASE_PATH}/${itemId}/analytics`
      );
      
      // Handle both direct data and wrapped responses
      const data = response.data;
      
      // If response is wrapped in a data object
      if (data && typeof data === 'object' && 'data' in data) {
        return (data as any).data;
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching analytics for item ${itemId}:`, error);
      // Return default analytics data instead of throwing
      return {
        total_movements: 0,
        average_daily_movement: 0,
        turnover_rate: 0,
        stock_health_score: 0,
        days_of_stock: null,
        last_restock_date: null,
        last_sale_date: null,
        trend: 'STABLE'
      };
    }
  },

  /**
   * Get comprehensive inventory view for a specific item
   * Includes both serialized units and bulk stock levels
   */
  async getItemAllInventory(
    itemId: string,
    params?: GetAllInventoryParams
  ): Promise<AllInventoryLocation[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const response = await apiClient.get<AllInventoryLocation[]>(
        `${BASE_PATH}/${itemId}/all-inventory?${queryParams.toString()}`
      );
      
      // Handle both direct array and wrapped responses
      const data = response.data;
      
      // If data is an array, return it directly
      if (Array.isArray(data)) {
        return data;
      }
      
      // If data is wrapped in a data object
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        return (data as any).data;
      }
      
      // Default to empty array
      console.warn('Unexpected response format from all-inventory API:', data);
      return [];
    } catch (error) {
      console.error(`Error fetching all inventory for item ${itemId}:`, error);
      return []; // Return empty array instead of throwing
    }
  },
};