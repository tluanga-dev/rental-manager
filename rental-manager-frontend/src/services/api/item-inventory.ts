import { apiClient } from '@/lib/axios';
import type {
  ItemInventoryOverview,
  ItemInventoryDetailed,
  ItemInventoryQueryParams,
} from '@/types/item-inventory';

export const itemInventoryApi = {
  // Get inventory overview for multiple items (optimized for table display)
  getOverview: async (params?: ItemInventoryQueryParams): Promise<ItemInventoryOverview[]> => {
    try {
      // Use the exact API endpoint: /api/inventory/stocks_info_all_items_brief
      const apiParams: Record<string, any> = {
        // Default parameters as specified
        sort_by: params?.sort_by || 'item_name',
        sort_order: params?.sort_order || 'asc', 
        skip: params?.skip || 0,
        limit: params?.limit || 100,
      };

      // Add optional parameters only if they have values
      if (params?.search) {
        apiParams.search = params.search;
      }
      if (params?.item_status && params.item_status !== 'all') {
        apiParams.item_status = params.item_status;
      }
      if (params?.stock_status && params.stock_status !== 'all') {
        apiParams.stock_status = params.stock_status;
      }
      if (params?.brand_id) {
        apiParams.brand = params.brand_id; // Backend uses 'brand' parameter
      }
      if (params?.category_id) {
        apiParams.category = params.category_id; // Backend uses 'category' parameter
      }
      if (params?.is_rentable !== undefined && params.is_rentable !== '') {
        apiParams.is_rentable = params.is_rentable;
      }
      if (params?.is_saleable !== undefined && params.is_saleable !== '') {
        apiParams.is_saleable = params.is_saleable;
      }

      console.log('🔍 Calling inventory API with params:', apiParams);

      const response = await apiClient.get('/inventory/stocks_info_all_items_brief', { 
        params: apiParams
      });
      
      console.log('🔍 Raw API response:', response.data);
      console.log('🔍 Response type:', typeof response.data);
      
      // Handle wrapped response from axios interceptor
      let dataArray = response.data;
      if (response.data && response.data.success && response.data.data) {
        dataArray = response.data.data;
        console.log('🔍 Using wrapped response.data.data');
      } else if (Array.isArray(response.data)) {
        console.log('🔍 Using direct array response.data');
      }
      
      console.log('🔍 Final data array:', Array.isArray(dataArray));
      console.log('🔍 Data array length:', dataArray?.length);
      
      // The response is a direct array or wrapped array
      if (Array.isArray(dataArray)) {
        console.log(`✅ Received ${dataArray.length} inventory items from API`);
        
        // Return the data in the new format directly
        const mappedData = dataArray.map((item: any, index: number) => {
          // Debug logging for first item
          if (index === 0) {
            console.log('🔍 First item raw data:', item);
            console.log('🔍 total_value field:', item.total_value);
            console.log('🔍 total_value type:', typeof item.total_value);
          }
          
          return {
            id: item.id || item.sku, // Use SKU as fallback ID
            sku: item.sku,
            item_name: item.item_name,
            item_status: item.item_status,
            brand: item.brand,
            category: item.category,
            unit_of_measurement: item.unit_of_measurement,
            rental_rate: item.rental_rate,
            sale_price: item.sale_price,
            total_value: item.total_value, // Include backend-calculated total value
            stock: {
              total: item.stock?.total || 0,
              available: item.stock?.available || 0,
              rented: item.stock?.rented || 0,
              status: item.stock?.status || 'OUT_OF_STOCK',
            },
            
            // Keep legacy fields for backward compatibility
            brand_name: item.brand,
            category_name: item.category,
            rental_rate_per_period: item.rental_rate,
            is_rentable: item.rental_rate ? true : false,
            is_saleable: item.sale_price ? true : false,
            total_units: item.stock?.total || 0,
            total_quantity_on_hand: item.stock?.total || 0,
            total_quantity_available: item.stock?.available || 0,
            total_quantity_on_rent: item.stock?.rented || 0,
            stock_status: item.stock?.status || 'OUT_OF_STOCK',
            reorder_point: 0,
            is_low_stock: item.stock?.status === 'LOW_STOCK',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        
        console.log(`✅ Mapped ${mappedData.length} items successfully`);
        console.log('🔍 Sample mapped item:', mappedData[0]);
        return mappedData;
      }
      
      // If no data matches expected format, return empty array
      console.warn('❌ Unexpected response format from inventory API:', response.data);
      console.warn('Expected an array, got:', typeof dataArray);
      console.warn('dataArray:', dataArray);
      return [];
    } catch (error) {
      console.error('❌ Error fetching inventory overview:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data
      });
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Get detailed inventory information for a single item
  getDetailed: async (itemId: string): Promise<ItemInventoryDetailed | null> => {
    try {
      const response = await apiClient.get(`/inventory/items/${itemId}/detailed`);
      
      // Handle wrapped response
      if (response.data && response.data.success) {
        return response.data.data;
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching detailed inventory for item ${itemId}:`, error);
      return null;
    }
  },

  // Get inventory with search functionality
  searchInventory: async (searchTerm: string, params?: Omit<ItemInventoryQueryParams, 'search'>): Promise<ItemInventoryOverview[]> => {
    return itemInventoryApi.getOverview({
      ...params,
      search: searchTerm,
    });
  },

  // Get low stock items
  getLowStockItems: async (params?: Omit<ItemInventoryQueryParams, 'stock_status'>): Promise<ItemInventoryOverview[]> => {
    return itemInventoryApi.getOverview({
      ...params,
      stock_status: 'LOW_STOCK',
    });
  },

  // Get out of stock items
  getOutOfStockItems: async (params?: Omit<ItemInventoryQueryParams, 'stock_status'>): Promise<ItemInventoryOverview[]> => {
    return itemInventoryApi.getOverview({
      ...params,
      stock_status: 'OUT_OF_STOCK',
    });
  },
};