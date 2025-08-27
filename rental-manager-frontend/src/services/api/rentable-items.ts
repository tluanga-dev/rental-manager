import { apiClient } from '@/lib/axios';
import type {
  RentableItem,
  RentableItemsParams,
  LocationAvailability,
  RentableBrand,
  RentableCategory,
  RentableUnitOfMeasurement,
  RentableInventoryUnit,
} from '@/types/rentable-items';

// New interface for the updated API response
interface NewRentableItemResponse {
  item_id: string;
  inventory_unit_id: string;
  itemname: string;
  itemcategory_name: string;
  rental_rate_per_period: number;
  rental_period: number;
  unit_of_measurement: string;
  available_units: Array<{
    location_id: string;
    location_name: string;
    available_units: number;
  }>;
}

// Transform new API response to rentable item format
const transformNewApiResponseToRentable = (item: NewRentableItemResponse): RentableItem => {
  // Calculate total available quantity from all locations
  const totalAvailable = item.available_units.reduce((total, unit) => total + unit.available_units, 0);
  
  return {
    id: item.item_id,
    sku: `${item.itemname.replace(/\s+/g, '-').toLowerCase()}-${item.item_id.slice(0, 8)}`,
    item_name: item.itemname,
    description: `${item.itemname} - ${item.itemcategory_name}`,
    brand: null, // Not provided in the new endpoint
    category: {
      id: null,
      name: item.itemcategory_name,
    },
    unit_of_measurement: {
      id: null,
      name: item.unit_of_measurement,
      abbreviation: item.unit_of_measurement,
    },
    rental_rate_per_period: item.rental_rate_per_period,
    rental_period: item.rental_period.toString(),
    security_deposit: 0, // Not provided in the new endpoint
    min_rental_days: 1, // Default value
    max_rental_days: 365, // Default value
    is_rentable: true, // All items from this endpoint are rentable
    is_saleable: false, // Default value
    total_available_quantity: totalAvailable,
    location_availability: item.available_units.map(unit => ({
      location_id: unit.location_id,
      location_name: unit.location_name,
      available_quantity: unit.available_units
    }))
  };
};

// Transform inventory unit to rentable item format (legacy fallback)
const transformInventoryUnitToRentable = (unit: RentableInventoryUnit, index: number): RentableItem => {
  return {
    id: unit.item_id, // Use the actual item_id from the API response
    sku: unit.serial_number || `${unit.item_name.replace(/\s+/g, '-').toLowerCase()}-${index}`,
    item_name: unit.item_name,
    description: unit.description || '',
    brand: null, // Not provided in the new endpoint
    category: null, // Not provided in the new endpoint
    unit_of_measurement: null, // Not provided in the new endpoint
    rental_rate_per_period: parseFloat(unit.rental_rate_per_period || '0'),
    rental_period: unit.rental_period || '1',
    security_deposit: parseFloat(unit.security_deposit || '0'),
    min_rental_days: 1, // Default value
    max_rental_days: 365, // Default value
    is_rentable: true, // All items from this endpoint are rentable
    is_saleable: false, // Default value
    total_available_quantity: parseFloat(unit.quantity_available || '0'),
    location_availability: [{
      location_id: unit.location_id,
      location_name: unit.location_name || 'Unknown',
      available_quantity: parseFloat(unit.quantity_available || '0')
    }]
  };
};

export const rentableItemsApi = {
  // Get all rentable items using the new endpoint
  getRentableItems: async (params: RentableItemsParams & { search_name?: string } = {}): Promise<RentableItem[]> => {
    const searchParams = new URLSearchParams();
    
    if (params.search_name) searchParams.append('search_name', params.search_name);
    if (params.location_id) searchParams.append('location_id', params.location_id);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    
    // Use the new rentable items endpoint (without /api prefix since apiClient handles that)
    const url = `/transactions/rentals/rentable_items${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    
    console.log('🌐 Making API call to rentable items endpoint:', {
      url: url,
      full_url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}${url}`,
      params: params,
      searchParams: searchParams.toString()
    });
    console.log(url)
    console.log(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}${url}`)
    try {
      const response = await apiClient.get<NewRentableItemResponse[]>(url);
      
      console.log('📡 Raw API response received:', {
        status: response.status,
        data_type: typeof response.data,
        data_keys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
        data_sample: response.data
      });
      
      // Handle the ApiResponse wrapper - apiClient always returns ApiResponse<T>
      const apiResponse = response.data as any;
      let itemsData: NewRentableItemResponse[];
      
      if (apiResponse && typeof apiResponse === 'object' && 'success' in apiResponse && apiResponse.success) {
        console.log('✅ API response has success wrapper, extracting data');
        itemsData = apiResponse.data;
      } else {
        console.log('📦 API response is direct data (no wrapper)');
        itemsData = apiResponse;
      }
      
      console.log('🔍 Processing items data:', {
        is_array: Array.isArray(itemsData),
        length: Array.isArray(itemsData) ? itemsData.length : 'N/A',
        first_item: Array.isArray(itemsData) && itemsData.length > 0 ? itemsData[0] : null
      });
      
      // Transform the new API response to our expected format
      if (Array.isArray(itemsData)) {
        const transformedItems = itemsData.map(transformNewApiResponseToRentable);
        console.log('🔄 Items transformed successfully:', {
          original_count: itemsData.length,
          transformed_count: transformedItems.length,
          sample_transformed: transformedItems.slice(0, 1)
        });
        return transformedItems;
      }
      
      console.warn('⚠️ Items data is not an array, returning empty array');
      return [];
    } catch (error) {
      console.error('❌ Error fetching rentable items:', {
        error: error,
        message: error.message,
        status: error.response?.status,
        status_text: error.response?.statusText,
        response_data: error.response?.data,
        url: url
      });
      return [];
    }
  },

  // Search rentable items by name
  searchByName: async (searchName: string, params: Omit<RentableItemsParams, 'search_name'> = {}): Promise<RentableItem[]> => {
    return rentableItemsApi.getRentableItems({
      ...params,
      search_name: searchName
    });
  },

  // Get rentable inventory units from the old inventory_unit/rentable endpoint (kept for backward compatibility)
  getRentableInventoryUnits: async (params: RentableItemsParams = {}): Promise<RentableInventoryUnit[]> => {
    const searchParams = new URLSearchParams();
    
    if (params.location_id) searchParams.append('location_id', params.location_id);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    
    // Use the inventory stocks endpoint with rentable filter
    searchParams.append('is_rentable', 'true'); // Filter for rentable items only
    const url = `/inventory/stocks${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    
    console.log('🔄 Making API call to inventory stocks endpoint:', {
      url: url,
      full_url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}${url}`,
      params: params,
      searchParams: searchParams.toString()
    });
    
    try {
      const response = await apiClient.get<RentableInventoryUnit[]>(url);
      
      console.log('📡 Fallback API response received:', {
        status: response.status,
        data_type: typeof response.data,
        data_keys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
        data_sample: response.data
      });
      
      // Handle the ApiResponse wrapper - apiClient always returns ApiResponse<T>
      const apiResponse = response.data as any;
      let unitsData: RentableInventoryUnit[];
      
      if (apiResponse && typeof apiResponse === 'object' && 'success' in apiResponse && apiResponse.success) {
        console.log('✅ Fallback API response has success wrapper, extracting data');
        unitsData = apiResponse.data;
      } else {
        console.log('📦 Fallback API response is direct data (no wrapper)');
        unitsData = apiResponse;
      }
      
      console.log('🔍 Processing fallback units data:', {
        is_array: Array.isArray(unitsData),
        length: Array.isArray(unitsData) ? unitsData.length : 'N/A',
        first_unit: Array.isArray(unitsData) && unitsData.length > 0 ? unitsData[0] : null
      });
      
      // Return the units as-is in the exact format from the API
      if (Array.isArray(unitsData)) {
        console.log('✅ Fallback units processed successfully:', unitsData.length);
        return unitsData;
      }
      
      console.warn('⚠️ Fallback units data is not an array, returning empty array');
      return [];
    } catch (error) {
      console.error('❌ Error fetching rentable inventory units (fallback):', {
        error: error,
        message: error.message,
        status: error.response?.status,
        status_text: error.response?.statusText,
        response_data: error.response?.data,
        url: url
      });
      return [];
    }
  },

  // Legacy compatibility method - maps to new getRentableItems
  getAvailable: async (params: RentableItemsParams & { search?: string } = {}): Promise<{ items: RentableItem[]; total: number }> => {
    const items = await rentableItemsApi.getRentableItems({
      ...params,
      search_name: params.search,
    });
    
    return {
      items,
      total: items.length, // Simple total for now
    };
  },

  // Get rentable items for a specific location
  getByLocation: async (locationId: string, params: Omit<RentableItemsParams, 'location_id'> = {}): Promise<RentableItem[]> => {
    return rentableItemsApi.getRentableItems({
      ...params,
      location_id: locationId
    });
  },

  // Get rentable items for a specific category
  getByCategory: async (categoryId: string, params: Omit<RentableItemsParams, 'category_id'> = {}): Promise<RentableItem[]> => {
    return rentableItemsApi.getRentableItems({
      ...params,
      category_id: categoryId
    });
  },

  // Get rentable items with pagination
  getPaginated: async (skip: number = 0, limit: number = 100, params: Omit<RentableItemsParams, 'skip' | 'limit'> = {}): Promise<RentableItem[]> => {
    return rentableItemsApi.getRentableItems({
      ...params,
      skip,
      limit
    });
  }
};

export default rentableItemsApi;