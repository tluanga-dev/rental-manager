import { apiClient } from '@/lib/axios';

// Transaction Types - Updated to match API_REFERENCE.md
export interface TransactionLineItem {
  item_id: string;
  inventory_unit_id?: string;
  quantity: number;
  unit_price: number;
  rental_days?: number;
}

export interface TransactionCreate {
  transaction_type: 'RENTAL' | 'SALE' | 'PURCHASE';
  customer_id?: string;
  location_id: string;
  transaction_date: string;
  due_date?: string;
  notes?: string;
  lines: TransactionLineItem[];
}

export interface PurchaseResponse {
  id: string;
  supplier_id: string;
  location_id: string;
  purchase_date: string;
  transaction_date: string;
  notes: string | null;
  reference_number: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  total_items: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  items: PurchaseItemResponse[];
  lines: PurchaseItemResponse[];
  supplier?: {
    id: string;
    name: string;
    company_name: string;
    supplier_code: string;
    display_name: string;
  };
  location?: {
    id: string;
    name: string;
    location_code: string;
  };
}

export interface PurchaseItemResponse {
  id: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  condition: string;
  notes: string | null;
  location_id: string | null;
  sku?: {
    id: string;
    sku_code: string;
    display_name: string;
    current_price: number;
  };
  location?: {
    id: string;
    name: string;
    location_code: string;
  };
}

export interface PurchaseListResponse {
  items: PurchaseResponse[];
  total: number;
  skip: number;
  limit: number;
}

// Purchase Return Types
export interface PurchaseReturnItemRecord {
  sku_id: string;
  quantity: number;
  unit_cost: number;
  return_reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'OVERSTOCKED' | 'QUALITY_ISSUE' | 'OTHER';
  condition?: 'A' | 'B' | 'C' | 'D';
  notes?: string;
}

export interface PurchaseReturnRecord {
  original_purchase_id: string;
  return_date: string;
  items: PurchaseReturnItemRecord[];
  return_reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'OVERSTOCKED' | 'QUALITY_ISSUE' | 'OTHER';
  notes?: string;
}

export interface PurchaseReturnResponse {
  id: string;
  supplier_id: string;
  original_purchase_id: string;
  return_date: string;
  notes: string | null;
  reference_number: string | null;
  total_amount: number;
  total_items: number;
  status: string;
  return_reason: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  items: PurchaseReturnItemRecord[];
  supplier?: {
    id: string;
    company_name: string;
    supplier_code: string;
    display_name: string;
  };
  original_purchase?: {
    id: string;
    reference_number: string;
    purchase_date: string;
    total_amount: number;
  };
}

export interface PurchaseReturnListResponse {
  items: PurchaseReturnResponse[];
  total: number;
  skip: number;
  limit: number;
}

// Purchase creation types - Aligned with backend schema
export interface PurchaseLineItem {
  item_id: string;
  quantity: number;
  unit_price: number; // Backend expects unit_price, not unit_cost
  location_id: string; // Each item needs location_id
  tax_rate?: number;
  discount_amount?: number;
  discount_percent?: number;
  condition_code?: 'A' | 'B' | 'C' | 'D'; // Backend expects condition_code
  serial_numbers?: string[];
  batch_code?: string;
  expiry_date?: string;
  warranty_months?: number;
  warehouse_location?: string;
}

export interface PurchaseRecord {
  supplier_id: string;
  location_id: string;
  purchase_date?: string; // Optional in backend
  reference_number?: string;
  notes?: string;
  
  // Required backend fields
  payment_method?: string; // Default to 'BANK_TRANSFER'
  payment_terms?: string; // Default to 'NET30' 
  payment_reference?: string;
  currency?: string; // Default to 'INR'
  shipping_amount?: number;
  other_charges?: number;
  
  // Items
  items: PurchaseLineItem[];
  
  // Additional optional fields
  tags?: string[];
  delivery_required?: boolean;
  delivery_address?: string;
  delivery_date?: string;
  due_date?: string;
}

export const purchasesApi = {
  // Create a new purchase
  recordPurchase: async (data: PurchaseRecord): Promise<PurchaseResponse> => {
    // Transform frontend data to match backend schema
    const backendPayload = {
      supplier_id: data.supplier_id,
      location_id: data.location_id,
      purchase_date: data.purchase_date,
      reference_number: data.reference_number,
      notes: data.notes,
      
      // Add required backend fields with defaults
      payment_method: data.payment_method || 'BANK_TRANSFER',
      payment_terms: data.payment_terms || 'NET30',
      payment_reference: data.payment_reference,
      currency: data.currency || 'INR',
      shipping_amount: data.shipping_amount || 0,
      other_charges: data.other_charges || 0,
      
      // Transform items array
      items: data.items.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        location_id: item.location_id,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        tax_rate: item.tax_rate || 0,
        condition_code: item.condition_code || 'A',
        serial_numbers: item.serial_numbers || [],
        batch_code: item.batch_code,
        expiry_date: item.expiry_date,
        warranty_months: item.warranty_months,
        warehouse_location: item.warehouse_location,
      })),
      
      // Additional optional fields
      tags: data.tags || [],
      delivery_required: data.delivery_required || false,
      delivery_address: data.delivery_address,
      delivery_date: data.delivery_date,
      due_date: data.due_date,
    };
    
    const response = await apiClient.post('/transactions/purchases', backendPayload);
    return response.data.success ? response.data.data : response.data;
  },

  // Get all purchases with optional filters
  getPurchases: async (params?: {
    skip?: number;
    limit?: number;
    supplier_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    search?: string;
    sort_order?: 'desc' | 'asc';
  }): Promise<PurchaseListResponse> => {
    try {
      console.log('Fetching purchases with params:', params);
      const response = await apiClient.get('/transactions/purchases/', { params });
      console.log('API raw response:', response);

      const rawData = response.data.success ? response.data.data : response.data;
      console.log('API raw data:', rawData);

      // Handle both paginated and non-paginated responses
      const items = Array.isArray(rawData) ? rawData : rawData.items || [];
      const total = Array.isArray(rawData) ? rawData.length : rawData.total || 0;
      const skip = Array.isArray(rawData) ? 0 : rawData.skip || 0;
      const limit = Array.isArray(rawData) ? items.length : rawData.limit || 20;

      console.log(`Extracted ${items.length} items, total: ${total}`);

      const transformedItems = items.map((item: any, index: number) => {
        console.log(`Transforming item ${index + 1}:`, item);
        const transformed = {
          id: item.id,
          supplier_id: item.supplier?.id || item.supplier_id,
          location_id: item.location?.id || item.location_id,
          purchase_date: item.purchase_date,
          transaction_date: item.purchase_date,
          notes: item.notes || '',
          reference_number: item.reference_number,
          subtotal: parseFloat(item.subtotal || 0),
          tax_amount: parseFloat(item.tax_amount || 0),
          discount_amount: parseFloat(item.discount_amount || 0),
          total_amount: parseFloat(item.total_amount || 0),
          total_items: item.items?.reduce((sum: number, lineItem: any) => sum + parseFloat(lineItem.quantity || 0), 0) || 0,
          status: item.status,
          payment_status: item.payment_status,
          created_at: item.created_at,
          updated_at: item.updated_at,
          created_by: item.created_by,
          updated_by: item.updated_by,
          lines: (item.items || []).map((lineItem: any) => ({
            id: lineItem.id,
            item_id: lineItem.item?.id || lineItem.item_id,
            description: lineItem.item?.name || lineItem.description || '',
            quantity: parseFloat(lineItem.quantity || 0),
            unit_cost: parseFloat(lineItem.unit_cost || 0),
            total_cost: parseFloat(lineItem.line_total || 0),
            condition: lineItem.condition || 'A',
            notes: lineItem.notes || '',
            location_id: item.location?.id || item.location_id,
          })),
          items: (item.items || []).map((lineItem: any) => ({
            id: lineItem.id,
            item_id: lineItem.item?.id || lineItem.item_id,
            description: lineItem.item?.name || lineItem.description || '',
            quantity: parseFloat(lineItem.quantity || 0),
            unit_cost: parseFloat(lineItem.unit_cost || 0),
            total_cost: parseFloat(lineItem.line_total || 0),
            condition: lineItem.condition || 'A',
            notes: lineItem.notes || '',
            location_id: item.location?.id || item.location_id,
          })),
          supplier: item.supplier ? {
            id: item.supplier.id,
            name: item.supplier.name,
            display_name: item.supplier.name,
            supplier_code: item.supplier.code || '',
            company_name: item.supplier.name
          } : undefined,
          location: item.location ? {
            id: item.location.id,
            name: item.location.name,
            location_code: item.location.code || ''
          } : undefined
        };
        console.log(`Transformed item ${index + 1}:`, transformed);
        return transformed;
      });

      const result = {
        items: transformedItems,
        total,
        skip,
        limit
      };
      console.log('Final result:', result);
      return result;

    } catch (error: any) {
      console.error('Failed to fetch purchases:', error);
      
      if (error.response) {
        console.error('API Error Response:', error.response.data);
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
      } else if (error.request) {
        console.error('API No Response:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      return {
        items: [],
        total: 0,
        skip: params?.skip || 0,
        limit: params?.limit || 20
      };
    }
  },

  // Get purchase by ID
  getPurchaseById: async (id: string): Promise<PurchaseResponse> => {
    try {
      const response = await apiClient.get(`/transactions/purchases/${id}`);
      const data = response.data.success ? response.data.data : response.data;
      
      // Transform the server structure to match frontend expectations
      return {
        id: data.id,
        supplier_id: data.supplier?.id || data.supplier_id,
        location_id: data.location?.id || data.location_id,
        purchase_date: data.purchase_date,
        transaction_date: data.purchase_date,
        notes: data.notes || '',
        reference_number: data.reference_number,
        subtotal: parseFloat(data.subtotal || 0),
        tax_amount: parseFloat(data.tax_amount || 0),
        discount_amount: parseFloat(data.discount_amount || 0),
        total_amount: parseFloat(data.total_amount || 0),
        total_items: data.items?.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0) || 0,
        status: data.status,
        payment_status: data.payment_status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        updated_by: data.updated_by,
        // Transform supplier info
        supplier: data.supplier ? {
          id: data.supplier.id,
          name: data.supplier.name,
          company_name: data.supplier.name,
          supplier_code: data.supplier.code || data.supplier.id.slice(0, 8),
          display_name: data.supplier.name
        } : undefined,
        // Transform location info
        location: data.location ? {
          id: data.location.id,
          name: data.location.name,
          location_code: data.location.code || data.location.id.slice(0, 8)
        } : undefined,
        // Transform items to both items and lines format
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          item_id: item.item?.id || item.item_id,
          description: item.item?.name || 'Unknown Item',
          quantity: parseFloat(item.quantity || 0),
          unit_cost: parseFloat(item.unit_cost || 0),
          total_cost: parseFloat(item.line_total || 0),
          condition: item.condition || 'A',
          notes: item.notes || '',
          location_id: data.location?.id || data.location_id,
          sku: item.item ? {
            id: item.item.id,
            sku_code: item.item.sku || item.item.id.slice(0, 8),
            display_name: item.item.name,
            current_price: parseFloat(item.unit_cost || 0)
          } : undefined,
          location: data.location ? {
            id: data.location.id,
            name: data.location.name,
            location_code: data.location.code || data.location.id.slice(0, 8)
          } : undefined
        })),
        lines: (data.items || []).map((item: any) => ({
          id: item.id,
          item_id: item.item?.id || item.item_id,
          description: item.item?.name || 'Unknown Item',
          quantity: parseFloat(item.quantity || 0),
          unit_cost: parseFloat(item.unit_cost || 0),
          total_cost: parseFloat(item.line_total || 0),
          condition: item.condition || 'A',
          notes: item.notes || '',
          location_id: data.location?.id || data.location_id,
          sku: item.item ? {
            id: item.item.id,
            sku_code: item.item.sku || item.item.id.slice(0, 8),
            display_name: item.item.name,
            current_price: parseFloat(item.unit_cost || 0)
          } : undefined,
          location: data.location ? {
            id: data.location.id,
            name: data.location.name,
            location_code: data.location.code || data.location.id.slice(0, 8)
          } : undefined
        }))
      };
    } catch (error) {
      console.error('Failed to fetch purchase:', error);
      throw error;
    }
  },

  // Get purchases by supplier
  getPurchasesBySupplier: async (
    supplierId: string,
    params?: {
      skip?: number;
      limit?: number;
      start_date?: string;
      end_date?: string;
      sort_order?: 'desc' | 'asc'; // desc = newest first, asc = oldest first
    }
  ): Promise<PurchaseListResponse> => {
    const response = await apiClient.get(`/transactions/purchases/supplier/${supplierId}`, { params });
    const data = response.data.success ? response.data.data : response.data;
    
    // Sort purchases by transaction date and time
    const sortedItems = (data.items || []).sort((a: any, b: any) => {
      // Primary sort: by purchase_date
      const dateA = new Date(a.purchase_date || a.transaction_date);
      const dateB = new Date(b.purchase_date || b.transaction_date);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return params?.sort_order === 'asc' 
          ? dateA.getTime() - dateB.getTime() // oldest first
          : dateB.getTime() - dateA.getTime(); // newest first (default)
      }
      
      // Secondary sort: by created_at time for same date
      const createdA = new Date(a.created_at);
      const createdB = new Date(b.created_at);
      return params?.sort_order === 'asc'
        ? createdA.getTime() - createdB.getTime() // oldest first
        : createdB.getTime() - createdA.getTime(); // newest first (default)
    });
    
    return {
      items: sortedItems,
      total: data.total || 0,
      skip: data.skip || 0,
      limit: data.limit || 20
    };
  },

  // Purchase Returns Management
  recordPurchaseReturn: async (data: PurchaseReturnRecord): Promise<PurchaseReturnResponse> => {
    const response = await apiClient.post('/transactions/purchase-returns', data);
    const returnData = response.data.success ? response.data.data : response.data;
    return returnData;
  },

  getPurchaseReturns: async (params?: {
    skip?: number;
    limit?: number;
    supplier_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<PurchaseReturnListResponse> => {
    const response = await apiClient.get('/transactions/purchase-returns', { params });
    const data = response.data.success ? response.data.data : response.data;
    return {
      items: data.items || [],
      total: data.total || 0,
      skip: data.skip || 0,
      limit: data.limit || 20
    };
  },

  getPurchaseReturnById: async (id: string): Promise<PurchaseReturnResponse> => {
    const response = await apiClient.get(`/transactions/purchase-returns/${id}`);
    return response.data.success ? response.data.data : response.data;
  },

  getPurchaseReturnsByPurchase: async (
    purchaseId: string,
    params?: {
      skip?: number;
      limit?: number;
    }
  ): Promise<PurchaseReturnListResponse> => {
    const response = await apiClient.get(`/transactions/purchase-returns/purchase/${purchaseId}`, { params });
    const data = response.data.success ? response.data.data : response.data;
    return {
      items: data.items || [],
      total: data.total || 0,
      skip: data.skip || 0,
      limit: data.limit || 20
    };
  },

  searchPurchases: async (query: string, limit: number = 10): Promise<PurchaseResponse[]> => {
    const response = await apiClient.get('/transactions/purchases/search', {
      params: { q: query, limit }
    });
    const data = response.data.success ? response.data.data : response.data;
    return data || [];
  },

  validatePurchaseReturn: async (
    purchaseId: string,
    items: { sku_id: string; quantity: number }[]
  ): Promise<{
    is_valid: boolean;
    available_items: {
      sku_id: string;
      max_returnable_quantity: number;
      original_quantity: number;
      already_returned: number;
    }[];
    errors: string[];
  }> => {
    const response = await apiClient.post('/transactions/purchase-returns/validate', {
      purchase_id: purchaseId,
      items
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Analytics and reporting
  getPurchaseAnalytics: async (params?: {
    start_date?: string;
    end_date?: string;
    supplier_id?: string;
    location_id?: string;
  }): Promise<{
    total_purchases: number;
    total_amount: number;
    total_items: number;
    average_order_value: number;
    top_suppliers: {
      supplier_id: string;
      supplier_name: string;
      total_purchases: number;
      total_amount: number;
    }[];
    monthly_trends: {
      month: string;
      total_purchases: number;
      total_amount: number;
    }[];
    return_statistics: {
      total_returns: number;
      total_refund_amount: number;
      return_rate: number;
      top_return_reasons: {
        reason: string;
        count: number;
      }[];
    };
  }> => {
    try {
      const response = await apiClient.get('/transactions/purchases/analytics', { params });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.error('Failed to fetch purchase analytics:', error);
      // Return empty analytics as fallback
      return {
        total_purchases: 0,
        total_amount: 0,
        total_items: 0,
        average_order_value: 0,
        top_suppliers: [],
        monthly_trends: [],
        return_statistics: {
          total_returns: 0,
          total_refund_amount: 0,
          return_rate: 0,
          top_return_reasons: []
        }
      };
    }
  }
};
