import { apiClient } from '@/lib/axios';
import type {
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  ItemListResponse,
  ItemSearchParams,
  SkuGenerationRequest,
  SkuGenerationResponse,
} from '@/types/item';

export const itemsApi = {
  // Create a new item - Updated for Item Master API
  create: async (data: CreateItemRequest): Promise<Item> => {
    // Log the payload being sent to the server
    console.log('🚀 Creating new item - Payload being sent to server:');
    console.log(JSON.stringify(data, null, 2));
    
    const response = await apiClient.post('/master-data/item-master/', data);
    return response.data.success ? response.data.data : response.data;
  },

  // Get all items with optional filters - Updated for Item Master API
  list: async (params?: ItemSearchParams): Promise<ItemListResponse> => {
    const response = await apiClient.get('/master-data/item-master/', { params });
    
    // Handle both formats: wrapped response or direct array
    let itemsData;
    if (response.data.success && response.data.data) {
      // Standard API wrapper format
      itemsData = response.data.data;
    } else {
      // Direct array response from API
      itemsData = response.data.success ? response.data.data : response.data;
    }
    
    // If itemsData is an array, transform it to ItemListResponse format
    if (Array.isArray(itemsData)) {
      // Transform nested API response to flat format expected by frontend
      const transformedItems = itemsData.map((item: any, index: number) => ({
        id: item.id || item.sku || `item-${index}-${Date.now()}`, // Use SKU as ID if no ID provided
        sku: item.sku || '',
        item_name: item.item_name || '',
        item_status: item.item_status || 'ACTIVE',
        category_id: item.category_id?.id || null,
        brand_id: item.brand_id?.id || null,
        unit_of_measurement_id: item.unit_of_measurement_id?.id || null,
        rental_rate_per_period: parseFloat(item.rental_rate_per_period) || 0,
        rental_period: item.rental_period || '1',
        sale_price: parseFloat(item.sale_price) || 0,
        purchase_price: parseFloat(item.purchase_price) || 0,
        security_deposit: parseFloat(item.security_deposit) || 0,
        description: item.description || null,
        specifications: item.specifications || null,
        model_number: item.model_number || null,
        serial_number_required: item.serial_number_required || false,
        warranty_period_days: item.warranty_period_days || '0',
        reorder_point: item.reorder_point || 0,
        initial_stock_quantity: item.initial_stock_quantity || 0,
        is_rentable: item.is_rentable || false,
        is_saleable: item.is_saleable || false,
        // Store nested data for potential future use
        brand_id_nested: item.brand_id,
        category_id_nested: item.category_id,
        unit_of_measurement_id_nested: item.unit_of_measurement_id,
      }));

      return {
        items: transformedItems,
        total: parseInt(response.headers['x-total-count'] || transformedItems.length.toString()),
        skip: parseInt(params?.skip?.toString() || '0'),
        limit: parseInt(params?.limit?.toString() || transformedItems.length.toString()),
      };
    }
    
    // If already in correct format, return as-is
    return itemsData;
  },

  // Get items for dropdown (formatted for ItemDropdown component)
  getItems: async (params?: {
    search?: string;
    category_id?: string;
    brand_id?: string;
    item_type?: 'RENTAL' | 'SALE' | 'BOTH';
    item_status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
    limit?: number;
    skip?: number;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      sku: string;
      item_code: string;
      status: string;
      price: number;
    }>;
    total: number;
  }> => {
    const response = await apiClient.get('/master-data/item-master/', { params });
    const data = response.data.success ? response.data.data : response.data;
    
    // Handle direct array response
    if (Array.isArray(data)) {
      return {
        items: data.map((item: any, index: number) => ({
          id: item.id || item.sku || `item-${index}-${Date.now()}`,
          name: item.item_name || '',
          sku: item.sku || '',
          item_code: item.item_code || item.sku || '',
          status: item.item_status || 'ACTIVE',
          price: parseFloat(item.rental_rate_per_period || item.sale_price || '0'),
        })),
        total: data.length,
      };
    }
    
    return {
      items: data.items ? data.items.map((item: any, index: number) => ({
        id: item.id || item.sku || `item-${index}-${Date.now()}`,
        name: item.item_name || '',
        sku: item.sku || '',
        item_code: item.item_code || item.sku || '',
        status: item.item_status || 'ACTIVE',
        price: parseFloat(item.rental_rate_per_period || item.sale_price || '0'),
      })) : [],
      total: data.total || 0,
    };
  },

  // Get item by ID - Updated for Item Master API
  getById: async (id: string): Promise<Item> => {
    const response = await apiClient.get(`/master-data/item-master/${id}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Get item by SKU
  getBySku: async (sku: string): Promise<Item> => {
    const response = await apiClient.get(`/master-data/item-master/sku/${sku}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Get item by item code
  getByItemCode: async (itemCode: string): Promise<Item> => {
    const response = await apiClient.get(`/master-data/item-master/code/${itemCode}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Update item - Updated for Item Master API
  update: async (id: string, data: UpdateItemRequest): Promise<Item> => {
    const response = await apiClient.put(`/master-data/item-master/${id}`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Update rental rate for an item - Specific function for dynamic rate entry
  updateRentalRate: async (itemId: string, rentalRatePerPeriod: number): Promise<Item> => {
    const response = await apiClient.put(`/master-data/item-master/${itemId}`, {
      rental_rate_per_period: rentalRatePerPeriod
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Update sale price for an item - Specific function for dynamic price entry
  updateSalePrice: async (itemId: string, salePrice: number): Promise<Item> => {
    const response = await apiClient.put(`/master-data/item-master/${itemId}`, {
      sale_price: salePrice
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Update item status (ACTIVE, INACTIVE, DISCONTINUED)
  updateStatus: async (id: string, item_status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'): Promise<Item> => {
    const response = await apiClient.put(`/master-data/item-master/${id}`, { item_status });
    return response.data.success ? response.data.data : response.data;
  },

  // Delete item (soft delete)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/master-data/item-master/${id}`);
  },

  // Search items by name, code, SKU, or description
  search: async (query: string, limit: number = 10): Promise<Item[]> => {
    const params = {
      search: query,
      limit,
    };
    const response = await apiClient.get('/master-data/item-master/', { params });
    const data = response.data.success ? response.data.data : response.data;
    
    // Transform the array response to include ID field
    if (Array.isArray(data)) {
      return data.map((item: any, index: number) => ({
        id: item.id || item.sku || `item-${index}-${Date.now()}`,
        sku: item.sku || '',
        item_name: item.item_name || '',
        item_status: item.item_status || 'ACTIVE',
        category_id: item.category_id?.id || null,
        brand_id: item.brand_id?.id || null,
        unit_of_measurement_id: item.unit_of_measurement_id?.id || null,
        rental_rate_per_period: parseFloat(item.rental_rate_per_period) || 0,
        rental_period: item.rental_period || '1',
        sale_price: parseFloat(item.sale_price) || 0,
        purchase_price: parseFloat(item.purchase_price) || 0,
        security_deposit: parseFloat(item.security_deposit) || 0,
        description: item.description || null,
        specifications: item.specifications || null,
        model_number: item.model_number || null,
        serial_number_required: item.serial_number_required || false,
        warranty_period_days: item.warranty_period_days || '0',
        reorder_point: item.reorder_point || 0,
        initial_stock_quantity: item.initial_stock_quantity || 0,
        is_rentable: item.is_rentable || false,
        is_saleable: item.is_saleable || false,
      }));
    }
    
    return data.items || [];
  },

  // Get items by category
  getByCategory: async (categoryId: string): Promise<Item[]> => {
    const response = await apiClient.get(`/master-data/item-master/category/${categoryId}`);
    const data = response.data.success ? response.data.data : response.data;
    return data.items || [];
  },

  // Get items by brand
  getByBrand: async (brandId: string): Promise<Item[]> => {
    const response = await apiClient.get(`/master-data/item-master/brand/${brandId}`);
    const data = response.data.success ? response.data.data : response.data;
    return data.items || [];
  },

  // Get only rental items (RENTAL or BOTH)
  getRentalItems: async (params?: ItemSearchParams): Promise<ItemListResponse> => {
    const response = await apiClient.get('/master-data/item-master/types/rental', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Get only sale items (SALE or BOTH)  
  getSaleItems: async (params?: ItemSearchParams): Promise<ItemListResponse> => {
    const response = await apiClient.get('/master-data/item-master/types/sale', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Get total count with filters
  getCount: async (params?: ItemSearchParams): Promise<{ count: number }> => {
    const response = await apiClient.get('/master-data/item-master/count/total', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Preview SKU generation without creating item
  generateSku: async (data: SkuGenerationRequest): Promise<SkuGenerationResponse> => {
    const response = await apiClient.post('/master-data/item-master/skus/generate', data);
    return response.data.success ? response.data.data : response.data;
  },


};