/**
 * API service for Inventory Items feature
 */
import { apiClient } from '@/lib/axios';
import type {
  InventoryItemSummary,
  InventoryItemDetail,
  InventoryItemDetailResponse,
  InventoryUnitDetail,
  StockMovementDetail,
  InventoryAnalytics,
  GetInventoryItemsParams,
  GetInventoryUnitsParams,
  GetMovementsParams,
  AllInventoryLocation,
  GetAllInventoryParams,
} from '@/types/inventory-items';

const BASE_PATH = '/inventory/stocks';

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
    
    const response = await apiClient.get<{success: boolean; data: any[]; total: number; skip: number; limit: number} | any[]>(
      `${BASE_PATH}?${queryParams.toString()}`
    );
    
    // Handle the standard API response format from inventory stocks endpoint
    const data = response.data;
    
    let rawItems: any[] = [];
    
    // If data is the standard API response format with success, data, total, etc.
    if (data && typeof data === 'object' && 'success' in data && 'data' in data && Array.isArray(data.data)) {
      rawItems = data.data;
    }
    // If data is an array, return it directly (fallback)
    else if (Array.isArray(data)) {
      rawItems = data;
    }
    // If data is an object with a 'data' property that's an array (fallback)
    else if (data && typeof data === 'object' && Array.isArray(data.data)) {
      rawItems = data.data;
    }
    // If data is an object with an 'items' property that's an array (fallback)
    else if (data && typeof data === 'object' && Array.isArray(data.items)) {
      rawItems = data.items;
    }
    
    // Transform the backend response to match frontend expectations
    // Backend sends flat properties, but frontend expects nested stock_summary
    const transformedItems: InventoryItemSummary[] = rawItems.map(item => {
      // Calculate total value from sale_price * total_quantity
      // If sale_price is not set, use purchase_price, otherwise 0
      const totalQty = item.total_quantity || item.total_units || 0;
      const unitPrice = item.sale_price || item.purchase_price || 0;
      const calculatedValue = totalQty * unitPrice;
      
      return {
        item_id: item.item_id,
        sku: item.sku,
        item_name: item.item_name,
        category: item.category,
        brand: item.brand,
        stock_summary: {
          total: totalQty,
          available: item.available_quantity || 0,
          reserved: item.reserved_quantity || 0,
          rented: item.on_rent_quantity || 0,
          in_maintenance: item.under_repair_quantity || 0,
          damaged: item.damaged_quantity || 0,
          stock_status: item.stock_status || 'OUT_OF_STOCK'
        },
        total_value: item.total_value || calculatedValue || 0,
        item_status: item.is_active ? 'ACTIVE' : 'INACTIVE',
        purchase_price: item.purchase_price,
        sale_price: item.sale_price,
        rental_rate: item.rental_rate,
        is_rentable: item.is_rentable || false,
        is_salable: item.is_salable || false
      };
    });
    
    return transformedItems;
  },

  /**
   * Get detailed information for a specific inventory item
   */
  async getItemDetail(itemId: string): Promise<InventoryItemDetail> {
    try {
      // Use the items endpoint for detailed item information
      const response = await apiClient.get<InventoryItemDetailResponse>(
        `/inventory/items/${itemId}`
      );
      
      // Handle the nested response structure with proper typing
      const responseData: InventoryItemDetailResponse = response.data;
      
      console.log('🔍 API Response structure:', JSON.stringify(responseData, null, 2));
      
      // Backend returns the expected structure from InventoryItemDetailResponse
      if (responseData?.data?.item) {
        const backendItem = responseData.data.item;
        
        // Map backend fields to frontend InventoryItemDetail interface
        const mappedItem: InventoryItemDetail = {
          item_id: backendItem.id, // Map id to item_id
          sku: backendItem.sku,
          item_name: backendItem.item_name,
          category: backendItem.category || { id: '', name: '', code: '' },
          brand: backendItem.brand || { id: '', name: '' },
          stock_summary: {
            total: responseData.data.total_units || 0,
            available: responseData.data.available_units || 0,
            reserved: responseData.data.reserved_units || 0,
            rented: responseData.data.rented_units || 0,
            in_maintenance: responseData.data.maintenance_units || 0,
            damaged: responseData.data.damaged_units || 0,
            stock_status: responseData.data.stock_status || 'OUT_OF_STOCK'
          },
          total_value: responseData.data.total_value || 0,
          item_status: backendItem.is_active ? 'ACTIVE' : 'INACTIVE',
          purchase_price: backendItem.purchase_price,
          sale_price: backendItem.sale_price,
          rental_rate: backendItem.rental_rate,
          is_rentable: backendItem.is_rentable || false,
          is_salable: backendItem.is_salable || false,
          description: backendItem.description,
          image_url: backendItem.image_url,
          location_breakdown: responseData.data.location_breakdown || [],
          min_stock_level: backendItem.min_stock_level,
          max_stock_level: backendItem.max_stock_level,
          created_at: backendItem.created_at,
          updated_at: backendItem.updated_at,
        };
        
        console.log('✅ Mapped item detail:', mappedItem);
        return mappedItem;
      }
      
      // Fallback for different response structures
      if (responseData?.data && !responseData.data.item) {
        // Direct item data without nesting
        const item = responseData.data;
        return {
          item_id: item.id || item.item_id,
          sku: item.sku,
          item_name: item.item_name,
          category: item.category,
          brand: item.brand,
          stock_summary: item.stock_summary || {
            total: 0,
            available: 0,
            reserved: 0,
            rented: 0,
            in_maintenance: 0,
            damaged: 0,
            stock_status: 'OUT_OF_STOCK'
          },
          total_value: item.total_value || 0,
          item_status: item.item_status || (item.is_active ? 'ACTIVE' : 'INACTIVE'),
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          rental_rate: item.rental_rate,
          is_rentable: item.is_rentable || false,
          is_salable: item.is_salable || false,
          description: item.description,
          image_url: item.image_url,
          location_breakdown: item.location_breakdown || [],
          min_stock_level: item.min_stock_level,
          max_stock_level: item.max_stock_level,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      }
      
      // If no data found
      throw new Error('Invalid response structure from API');
      
    } catch (error) {
      console.error(`❌ Error fetching item detail for ${itemId}:`, error);
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
      
      const response = await apiClient.get<any>(
        `/inventory/items/${itemId}/units?${queryParams.toString()}`
      );
      
      // Handle the API response structure
      const data = response.data;
      
      console.log('🔍 API Response structure check:');
      console.log('  - Response type:', typeof data);
      console.log('  - Has success?', 'success' in data);
      console.log('  - Has data?', 'data' in data);
      if (data && data.data) {
        console.log('  - data.data type:', typeof data.data);
        console.log('  - Has inventory_units?', 'inventory_units' in data.data);
        if (data.data.inventory_units) {
          console.log('  - Units count:', data.data.inventory_units.length);
          console.log('  - First unit sample:', JSON.stringify(data.data.inventory_units[0], null, 2));
        }
      }
      
      // The API returns: { success: true, data: { item_id, item_name, sku, inventory_units: [...], total_units } }
      // Simplified check - just look for the inventory_units wherever they are
      let rawUnits = null;
      
      if (data?.data?.inventory_units) {
        rawUnits = data.data.inventory_units;
        console.log('📦 Found units in data.data.inventory_units');
      } else if (data?.inventory_units) {
        rawUnits = data.inventory_units;
        console.log('📦 Found units in data.inventory_units');
      } else if (Array.isArray(data?.data)) {
        rawUnits = data.data;
        console.log('📦 Found units as data.data array');
      } else if (Array.isArray(data)) {
        rawUnits = data;
        console.log('📦 Found units as direct array');
      }
      
      if (rawUnits && Array.isArray(rawUnits)) {
        console.log(`✅ Processing ${rawUnits.length} units for mapping`);
        if (rawUnits.length > 0) {
          console.log('🔍 Raw unit fields:', Object.keys(rawUnits[0]));
          console.log('🔍 Raw unit rental_rate_per_period:', rawUnits[0].rental_rate_per_period);
          console.log('🔍 Raw unit rental_rate:', rawUnits[0].rental_rate);
          console.log('🔍 Raw unit sale_price:', rawUnits[0].sale_price);
        }
        
        // Map the API response to match frontend expectations
        const units = rawUnits.map((unit: any) => ({
          id: unit.id,
          unit_identifier: unit.sku || unit.unit_identifier || '',
          serial_number: unit.serial_number,
          location_id: unit.location?.id || unit.location_id || '',
          location_name: unit.location?.name || unit.location_name || '',
          status: unit.status || 'AVAILABLE',
          condition: unit.condition || unit.condition_display || '',
          last_movement: unit.last_movement,
          acquisition_date: unit.purchase_date || unit.acquisition_date || unit.created_at,
          acquisition_cost: unit.purchase_price || unit.acquisition_cost,
          notes: unit.notes,
          // Pricing fields
          rental_rate_per_period: unit.rental_rate_per_period || unit.rental_rate,
          sale_price: unit.sale_price,
          // Rental blocking fields
          is_rental_blocked: unit.is_rental_blocked || false,
          rental_block_reason: unit.rental_block_reason,
          rental_blocked_at: unit.rental_blocked_at,
          rental_blocked_by: unit.rental_blocked_by,
        }));
        
        console.log('✅ Mapped units successfully, returning', units.length, 'units');
        if (units.length > 0) {
          console.log('✅ Sample mapped unit:', JSON.stringify(units[0], null, 2));
        }
        return units;
      }
      
      // Default to empty array for units (item might not be serialized)
      console.warn('⚠️ No units found in response, returning empty array');
      return [];
    } catch (error) {
      console.error(`❌ Error fetching units for item ${itemId}:`, error);
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
        `/inventory/items/${itemId}/movements?${queryParams.toString()}`
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
        `/inventory/items/${itemId}/analytics`
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
        `/inventory/items/${itemId}/all-inventory?${queryParams.toString()}`
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

  /**
   * Update an item's rentable status
   */
  async updateRentableStatus(itemId: string, isRentable: boolean): Promise<InventoryItemDetail> {
    try {
      console.log(`🔄 Updating rentable status for item ${itemId} to ${isRentable}`);
      
      // Use the correct endpoint - should be inventory/items not just items
      const response = await apiClient.put<any>(
        `/inventory/items/${itemId}`,
        {
          is_rentable: isRentable
        }
      );
      
      console.log('🔍 Update response:', JSON.stringify(response.data, null, 2));
      
      // Handle the response structure similar to getItemDetail
      const responseData = response.data;
      
      // Backend returns updated item in nested structure
      if (responseData?.data?.item) {
        const backendItem = responseData.data.item;
        
        // Map the response using the same pattern as getItemDetail
        const mappedItem: InventoryItemDetail = {
          item_id: backendItem.id,
          sku: backendItem.sku,
          item_name: backendItem.item_name,
          category: backendItem.category,
          brand: backendItem.brand,
          stock_summary: {
            total: responseData.data.total_units || 0,
            available: responseData.data.available_units || 0,
            reserved: responseData.data.reserved_units || 0,
            rented: responseData.data.rented_units || 0,
            in_maintenance: responseData.data.maintenance_units || 0,
            damaged: responseData.data.damaged_units || 0,
            stock_status: responseData.data.stock_status || 'OUT_OF_STOCK'
          },
          total_value: responseData.data.total_value || 0,
          item_status: backendItem.is_active ? 'ACTIVE' : 'INACTIVE',
          purchase_price: backendItem.purchase_price,
          sale_price: backendItem.sale_price,
          rental_rate: backendItem.rental_rate,
          is_rentable: backendItem.is_rentable || false,
          is_salable: backendItem.is_salable || false,
          description: backendItem.description,
          image_url: backendItem.image_url,
          location_breakdown: responseData.data.location_breakdown || [],
          min_stock_level: backendItem.min_stock_level,
          max_stock_level: backendItem.max_stock_level,
          created_at: backendItem.created_at,
          updated_at: backendItem.updated_at,
        };
        
        console.log('✅ Updated item mapped successfully:', mappedItem);
        return mappedItem;
      }
      
      // Fallback if direct item data
      if (responseData?.data && !responseData.data.item) {
        const item = responseData.data;
        return {
          item_id: item.id || item.item_id,
          sku: item.sku,
          item_name: item.item_name,
          category: item.category,
          brand: item.brand,
          stock_summary: item.stock_summary || {
            total: 0,
            available: 0,
            reserved: 0,
            rented: 0,
            in_maintenance: 0,
            damaged: 0,
            stock_status: 'OUT_OF_STOCK'
          },
          total_value: item.total_value || 0,
          item_status: item.item_status || (item.is_active ? 'ACTIVE' : 'INACTIVE'),
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          rental_rate: item.rental_rate,
          is_rentable: item.is_rentable || false,
          is_salable: item.is_salable || false,
          description: item.description,
          image_url: item.image_url,
          location_breakdown: item.location_breakdown || [],
          min_stock_level: item.min_stock_level,
          max_stock_level: item.max_stock_level,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      }
      
      throw new Error('Invalid response structure from update API');
      
    } catch (error) {
      console.error(`❌ Error updating rentable status for item ${itemId}:`, error);
      throw error;
    }
  },
};