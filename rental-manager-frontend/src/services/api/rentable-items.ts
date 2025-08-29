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

// New interface for the updated API response - flexible to handle different field names
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
    // The API might return different field names for quantity
    available_units?: number;     // Expected field name
    quantity?: number | string;   // Alternative field name
    available_quantity?: number | string; // Another alternative
    stock?: number | string;      // Another alternative
    [key: string]: any;           // Allow additional fields
  }>;
}

// Transform new API response to rentable item format with defensive programming
const transformNewApiResponseToRentable = (item: NewRentableItemResponse): RentableItem => {
  // Add comprehensive logging to debug the actual API response
  console.log('🔍 Raw API item received for transformation:', {
    item_id: item?.item_id,
    itemname: item?.itemname,
    available_units: item?.available_units,
    full_item: item
  });
  
  // Validate required fields
  if (!item || !item.item_id) {
    console.error('❌ Invalid item: missing item_id', item);
    throw new Error('Invalid item: missing item_id');
  }
  
  // Calculate total available quantity from all locations with comprehensive field checking
  const availableUnits = Array.isArray(item.available_units) ? item.available_units : [];
  console.log('📦 Processing available units:', availableUnits);
  
  const totalAvailable = availableUnits.reduce((total, unit, index) => {
    console.log(`🔢 Processing unit ${index}:`, unit);
    
    // Check multiple possible field names for quantity
    const quantity = 
      unit?.available_units ??      // Current expected field
      (unit as any)?.quantity ??    // Alternative field name
      (unit as any)?.available_quantity ?? // Another alternative
      (unit as any)?.stock ??       // Another alternative
      0;
    
    // Parse to number if it's a string
    const numQuantity = typeof quantity === 'string' ? parseFloat(quantity) : 
                       typeof quantity === 'number' ? quantity : 0;
    
    console.log(`  - Field found: ${quantity} (type: ${typeof quantity})`);
    console.log(`  - Parsed quantity: ${numQuantity}`);
    
    if (isNaN(numQuantity)) {
      console.warn(`⚠️ Invalid quantity found in unit:`, unit);
      return total;
    }
    
    return total + numQuantity;
  }, 0);
  
  console.log('📊 Total available quantity calculated:', totalAvailable);
  
  // Generate safe SKU with fallbacks
  const itemName = item.itemname || 'unnamed-item';
  const safeItemName = itemName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
  const itemIdShort = item.item_id ? item.item_id.slice(0, 8) : 'no-id';
  
  return {
    id: item.item_id,
    sku: `${safeItemName}-${itemIdShort}`,
    item_name: item.itemname || 'Unnamed Item',
    description: `${item.itemname || 'Unnamed Item'}${item.itemcategory_name ? ` - ${item.itemcategory_name}` : ''}`,
    brand: null, // Not provided in the new endpoint
    category: {
      id: null,
      name: item.itemcategory_name || 'Uncategorized',
    },
    unit_of_measurement: {
      id: null,
      name: item.unit_of_measurement || 'Unit',
      abbreviation: item.unit_of_measurement || 'Unit',
    },
    rental_rate_per_period: typeof item.rental_rate_per_period === 'number' ? item.rental_rate_per_period : 0,
    rental_period: (item.rental_period || 1).toString(),
    security_deposit: 0, // Not provided in the new endpoint
    min_rental_days: 1, // Default value
    max_rental_days: 365, // Default value
    is_rentable: true, // All items from this endpoint are rentable
    is_saleable: false, // Default value
    total_available_quantity: totalAvailable,
    location_availability: availableUnits
      .filter(unit => unit && unit.location_id) // Filter out invalid units
      .map((unit, index) => {
        // Check multiple possible field names for quantity (same logic as above)
        const quantity = 
          unit?.available_units ??      // Current expected field
          (unit as any)?.quantity ??    // Alternative field name
          (unit as any)?.available_quantity ?? // Another alternative
          (unit as any)?.stock ??       // Another alternative
          0;
        
        // Parse to number if it's a string
        const numQuantity = typeof quantity === 'string' ? parseFloat(quantity) : 
                           typeof quantity === 'number' ? quantity : 0;
        
        console.log(`📍 Location ${index} quantity mapping:`, {
          location_id: unit.location_id,
          location_name: unit.location_name,
          raw_quantity: quantity,
          parsed_quantity: numQuantity
        });
        
        return {
          location_id: unit.location_id,
          location_name: unit.location_name || 'Unknown Location',
          available_quantity: isNaN(numQuantity) ? 0 : numQuantity
        };
      })
  };
};

// Transform inventory unit to rentable item format (legacy fallback) with defensive programming
const transformInventoryUnitToRentable = (unit: RentableInventoryUnit, index: number): RentableItem => {
  // Validate required fields
  if (!unit || !unit.item_id) {
    throw new Error('Invalid inventory unit: missing item_id');
  }
  
  // Generate safe SKU with fallbacks
  const itemName = unit.item_name || 'unnamed-item';
  const safeItemName = itemName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
  const fallbackSku = `${safeItemName}-${index}`;
  
  return {
    id: unit.item_id, // Use the actual item_id from the API response
    sku: unit.serial_number || fallbackSku,
    item_name: unit.item_name || 'Unnamed Item',
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
      location_id: unit.location_id || '',
      location_name: unit.location_name || unit.name || 'Unknown Location', // Use location_name first, then name, then fallback
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
      
      // Handle different API response formats with better error handling
      const apiResponse = response.data as any;
      let itemsData: NewRentableItemResponse[] = [];
      
      if (apiResponse) {
        if (Array.isArray(apiResponse)) {
          console.log('📦 API response is direct array');
          itemsData = apiResponse;
        } else if (typeof apiResponse === 'object' && 'success' in apiResponse && apiResponse.success) {
          console.log('✅ API response has success wrapper, extracting data');
          itemsData = Array.isArray(apiResponse.data) ? apiResponse.data : [];
        } else if (typeof apiResponse === 'object' && 'data' in apiResponse) {
          console.log('📦 API response has data field without success wrapper');
          itemsData = Array.isArray(apiResponse.data) ? apiResponse.data : [];
        } else {
          console.log('📦 API response is object but not recognized format');
          itemsData = [];
        }
      } else {
        console.warn('⚠️ API response is null or undefined');
        itemsData = [];
      }
      
      console.log('🔍 Processing items data:', {
        is_array: Array.isArray(itemsData),
        length: Array.isArray(itemsData) ? itemsData.length : 'N/A',
        first_item: Array.isArray(itemsData) && itemsData.length > 0 ? itemsData[0] : null
      });
      
      // Transform the new API response to our expected format with better error handling
      if (Array.isArray(itemsData) && itemsData.length > 0) {
        console.log('🔄 Transforming items data:', {
          original_count: itemsData.length,
          sample_item: itemsData[0]
        });
        
        const transformedItems = itemsData
          .filter(item => item && typeof item === 'object') // Filter out invalid items
          .map(item => {
            try {
              return transformNewApiResponseToRentable(item);
            } catch (error) {
              console.error('❌ Error transforming item:', item, error);
              return null;
            }
          })
          .filter(item => item !== null); // Remove failed transformations
          
        console.log('🔄 Items transformed successfully:', {
          original_count: itemsData.length,
          transformed_count: transformedItems.length,
          sample_transformed: transformedItems.slice(0, 1)
        });
        return transformedItems;
      } else if (Array.isArray(itemsData) && itemsData.length === 0) {
        console.log('📦 API returned empty array - no items available');
        return [];
      } else {
        console.warn('⚠️ Items data is not a valid array:', typeof itemsData, itemsData);
        return [];
      }
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
      
      // Handle different API response formats with better error handling
      const apiResponse = response.data as any;
      let unitsData: RentableInventoryUnit[] = [];
      
      if (apiResponse) {
        if (Array.isArray(apiResponse)) {
          console.log('📦 Fallback API response is direct array');
          unitsData = apiResponse;
        } else if (typeof apiResponse === 'object' && 'success' in apiResponse && apiResponse.success) {
          console.log('✅ Fallback API response has success wrapper, extracting data');
          unitsData = Array.isArray(apiResponse.data) ? apiResponse.data : [];
        } else if (typeof apiResponse === 'object' && 'data' in apiResponse) {
          console.log('📦 Fallback API response has data field without success wrapper');
          unitsData = Array.isArray(apiResponse.data) ? apiResponse.data : [];
        } else {
          console.log('📦 Fallback API response is object but not recognized format');
          unitsData = [];
        }
      } else {
        console.warn('⚠️ Fallback API response is null or undefined');
        unitsData = [];
      }
      
      console.log('🔍 Processing fallback units data:', {
        is_array: Array.isArray(unitsData),
        length: Array.isArray(unitsData) ? unitsData.length : 'N/A',
        first_unit: Array.isArray(unitsData) && unitsData.length > 0 ? unitsData[0] : null
      });
      
      // Process and validate the units data
      if (Array.isArray(unitsData) && unitsData.length > 0) {
        // Filter out invalid units and add defensive checks
        const validUnits = unitsData.filter(unit => {
          return unit && typeof unit === 'object' && unit.item_id;
        });
        
        console.log('✅ Fallback units processed successfully:', {
          original_count: unitsData.length,
          valid_count: validUnits.length,
          sample_unit: validUnits[0]
        });
        return validUnits;
      } else if (Array.isArray(unitsData) && unitsData.length === 0) {
        console.log('📦 Fallback API returned empty array - no inventory units available');
        return [];
      } else {
        console.warn('⚠️ Fallback units data is not a valid array:', typeof unitsData, unitsData);
        return [];
      }
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