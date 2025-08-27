import { apiClient } from '@/lib/axios';

// Supplier Types - Updated to match actual backend schema
export interface SupplierCreate {
  code: string;
  name: string;
  supplier_type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'INVENTORY' | 'SERVICE' | 'DIRECT';
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  tax_id?: string;
  payment_terms?: string;
  credit_limit?: number;
  rating?: number;
  notes?: string;
}

export interface SupplierUpdate {
  name?: string;
  supplier_type?: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'INVENTORY' | 'SERVICE' | 'DIRECT';
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  tax_id?: string;
  payment_terms?: string;
  credit_limit?: number;
  rating?: number;
  notes?: string;
}

export interface SupplierResponse {
  id: string;
  code: string;
  name: string;
  supplier_type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'INVENTORY' | 'SERVICE' | 'DIRECT';
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  website?: string | null;
  tax_id?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  rating?: number | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  average_delivery_days?: number;
  last_order_date?: string;
}

export interface SupplierListResponse {
  items: SupplierResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface SupplierAnalytics {
  total_suppliers: number;
  active_suppliers: number;
  supplier_type_distribution: {
    manufacturer: number;
    distributor: number;
    wholesaler: number;
    retailer: number;
    service_provider: number;
  };
  supplier_tier_distribution: {
    preferred: number;
    standard: number;
    restricted: number;
  };
  payment_terms_distribution: {
    [key: string]: number;
  };
  monthly_new_suppliers: Array<{
    month: string;
    count: number;
  }>;
  top_suppliers_by_spend: Array<{
    supplier: SupplierResponse;
    total_spend: number;
  }>;
  total_spend: number;
  average_quality_rating: number;
}

export interface SupplierPerformanceHistory {
  supplier: SupplierResponse;
  performance_metrics: {
    total_orders: number;
    total_spend: number;
    average_delivery_days: number;
    quality_rating: number;
    performance_score: number;
    last_order_date: string | null;
  };
  trends: {
    delivery_trend: string;
    quality_trend: string;
    spend_trend: string;
  };
  recommendations: string[];
}

export const suppliersApi = {
  // Create a new supplier
  create: async (data: SupplierCreate): Promise<SupplierResponse> => {
    const response = await apiClient.post('/suppliers/', data);
    return response.data.success ? response.data.data : response.data;
  },

  // Get all suppliers with optional filters
  list: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    supplier_type?: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'SERVICE_PROVIDER';
    supplier_tier?: 'PREFERRED' | 'STANDARD' | 'RESTRICTED';
    status?: 'ACTIVE';
    active_only?: boolean;
  }): Promise<SupplierListResponse> => {
    try {
      const response = await apiClient.get('/suppliers/', { params });
      const data = response.data.success ? response.data.data : response.data;
      
      // Handle both array response and paginated response
      if (Array.isArray(data)) {
        // Transform suppliers to include missing fields with defaults and proper field mapping
        const transformedSuppliers = data.map((supplier: any) => ({
          ...supplier,
          // Handle field name inconsistencies
          company_name: supplier.company_name || supplier.name,
          supplier_code: supplier.supplier_code || supplier.code,
          name: supplier.name || supplier.company_name,
          code: supplier.code || supplier.supplier_code,
          // Ensure numeric fields are properly typed
          supplier_tier: supplier.supplier_tier || 'STANDARD',
          total_spend: parseFloat(supplier.total_spend?.toString() || '0') || 0,
          total_orders: parseInt(supplier.total_orders?.toString() || '0') || 0,
          quality_rating: parseFloat(supplier.quality_rating?.toString() || '0') || 0,
          performance_score: parseFloat(supplier.performance_score?.toString() || '75') || 75,
          average_delivery_days: parseInt(supplier.average_delivery_days?.toString() || '7') || 7,
          last_order_date: supplier.last_order_date || null,
        }));
        
        return {
          items: transformedSuppliers,
          total: transformedSuppliers.length,
          page: 1,
          page_size: transformedSuppliers.length,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        };
      }
      
      // If paginated response, transform the items
      if (data.items) {
        const transformedSuppliers = data.items.map((supplier: any) => ({
          ...supplier,
          // Handle field name inconsistencies
          company_name: supplier.company_name || supplier.name,
          supplier_code: supplier.supplier_code || supplier.code,
          name: supplier.name || supplier.company_name,
          code: supplier.code || supplier.supplier_code,
          // Ensure numeric fields are properly typed
          supplier_tier: supplier.supplier_tier || 'STANDARD',
          total_spend: parseFloat(supplier.total_spend?.toString() || '0') || 0,
          total_orders: parseInt(supplier.total_orders?.toString() || '0') || 0,
          quality_rating: parseFloat(supplier.quality_rating?.toString() || '0') || 0,
          performance_score: parseFloat(supplier.performance_score?.toString() || '75') || 75,
          average_delivery_days: parseInt(supplier.average_delivery_days?.toString() || '7') || 7,
          last_order_date: supplier.last_order_date || null,
        }));
        
        return {
          ...data,
          items: transformedSuppliers,
        };
      }
      
      return data;
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      throw error;
    }
  },

  // Get suppliers for dropdown (formatted for SupplierDropdown component)
  getSuppliers: async (params?: {
    search?: string;
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{
    suppliers: Array<{
      id: string;
      name: string;
      code: string;
      status: string;
    }>;
    total: number;
  }> => {
    try {
      const apiParams = {
        search: params?.search,
        active_only: params?.status === 'inactive' ? false : params?.status === 'all' ? undefined : true,
        limit: params?.limit || 100,
        skip: params?.offset || 0,
      };

      const response = await apiClient.get('/suppliers/', { params: apiParams });
      const data = response.data.success ? response.data.data : response.data;
      
      // Handle both array response and paginated response
      if (Array.isArray(data)) {
        return {
          suppliers: data.map((supplier: any) => ({
            id: supplier.id,
            name: supplier.company_name || supplier.name || '',
            code: supplier.supplier_code || supplier.code || '',
            status: supplier.is_active ? 'active' : 'inactive',
          })),
          total: data.length,
        };
      }
      
      // Handle paginated response
      if (data && data.items) {
        return {
          suppliers: data.items.map((supplier: any) => ({
            id: supplier.id,
            name: supplier.company_name || supplier.name || '',
            code: supplier.supplier_code || supplier.code || '',
            status: supplier.is_active ? 'active' : 'inactive',
          })),
          total: data.total || data.items.length,
        };
      }
      
      // Fallback for empty response
      return {
        suppliers: [],
        total: 0,
      };
    } catch (error) {
      console.error('Failed to load suppliers for dropdown:', error);
      throw error;
    }
  },

  // Get supplier by ID
  getById: async (id: string): Promise<SupplierResponse> => {
    const response = await apiClient.get(`/suppliers/${id}`);
    const rawData = response.data.success ? response.data.data : response.data;
    
    // Transform the supplier data to match expected interface
    const transformedSupplier = {
      ...rawData,
      // Handle field name inconsistencies
      company_name: rawData.company_name || rawData.name,
      supplier_code: rawData.supplier_code || rawData.code,
      name: rawData.name || rawData.company_name,
      code: rawData.code || rawData.supplier_code,
      // Ensure required fields are present with defaults
      supplier_tier: rawData.supplier_tier || 'STANDARD',
      total_spend: parseFloat(rawData.total_spend?.toString() || '0') || 0,
      total_orders: parseInt(rawData.total_orders?.toString() || '0') || 0,
      quality_rating: parseFloat(rawData.quality_rating?.toString() || '0') || 0,
      performance_score: parseFloat(rawData.performance_score?.toString() || '75') || 75,
      average_delivery_days: parseInt(rawData.average_delivery_days?.toString() || '7') || 7,
      last_order_date: rawData.last_order_date || null,
      // Handle address fields
      address: rawData.address || (rawData.address_line1 ? 
        [rawData.address_line1, rawData.address_line2, rawData.city, rawData.state, rawData.postal_code]
          .filter(Boolean).join(', ') : null),
      // Handle credit limit as number
      credit_limit: parseFloat(rawData.credit_limit?.toString() || '0') || 0,
      // Ensure proper payment terms format
      payment_terms: rawData.payment_terms || 'NET30'
    };
    
    return transformedSupplier;
  },

  // Get supplier by code
  getByCode: async (code: string): Promise<SupplierResponse> => {
    const response = await apiClient.get(`/suppliers/code/${code}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Update supplier
  update: async (id: string, data: SupplierUpdate): Promise<SupplierResponse> => {
    const response = await apiClient.put(`/suppliers/${id}`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Update supplier status
  updateStatus: async (id: string, is_active: boolean): Promise<SupplierResponse> => {
    const response = await apiClient.put(`/suppliers/${id}/status`, { is_active });
    return response.data.success ? response.data.data : response.data;
  },

  // Update supplier performance metrics
  updatePerformance: async (id: string, metrics: {
    total_orders?: number;
    total_spend?: number;
    average_delivery_days?: number;
    quality_rating?: number;
  }): Promise<SupplierResponse> => {
    const response = await apiClient.patch(`/suppliers/${id}/performance`, metrics);
    return response.data.success ? response.data.data : response.data;
  },

  // Delete supplier (soft delete)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/suppliers/${id}`);
  },

  // Search suppliers by name
  searchByName: async (name: string, limit: number = 10): Promise<SupplierResponse[]> => {
    const response = await apiClient.get('/suppliers/search', { 
      params: { search_term: name, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get suppliers by tier
  getByTier: async (
    tier: string, 
    skip: number = 0, 
    limit: number = 100
  ): Promise<SupplierListResponse> => {
    const response = await apiClient.get(`/suppliers/type/${tier}`, { 
      params: { skip, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get top suppliers by spend
  getTopBySpend: async (limit: number = 10): Promise<SupplierResponse[]> => {
    const response = await apiClient.get('/suppliers/statistics', { 
      params: { limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get supplier analytics
  getAnalytics: async (): Promise<SupplierAnalytics> => {
    try {
      // Use the correct endpoint for supplier statistics
      const response = await apiClient.get('/suppliers/statistics');
      
      // The axios interceptor wraps the response in { success: true, data: actualData }
      const rawStats = response.data.success ? response.data.data : response.data;
      console.log('Supplier Statistics API response:', rawStats);
      
      // Transform the backend statistics to match frontend SupplierAnalytics interface
      const analytics: SupplierAnalytics = {
        total_suppliers: rawStats.total_suppliers || 0,
        active_suppliers: rawStats.active_suppliers || 0,
        
        // Create supplier type distribution from the recent suppliers data
        supplier_type_distribution: {
          manufacturer: rawStats.recent_suppliers?.filter((s: any) => s.supplier_type === 'MANUFACTURER').length || 0,
          distributor: rawStats.recent_suppliers?.filter((s: any) => s.supplier_type === 'DISTRIBUTOR').length || 0,
          wholesaler: rawStats.recent_suppliers?.filter((s: any) => s.supplier_type === 'WHOLESALER').length || 0,
          retailer: rawStats.recent_suppliers?.filter((s: any) => s.supplier_type === 'RETAILER').length || 0,
          service_provider: rawStats.recent_suppliers?.filter((s: any) => s.supplier_type === 'SERVICE_PROVIDER').length || 0,
        },
        
        // Create supplier tier distribution from the recent suppliers data
        supplier_tier_distribution: {
          preferred: rawStats.recent_suppliers?.filter((s: any) => s.supplier_tier === 'PREFERRED').length || 0,
          standard: rawStats.recent_suppliers?.filter((s: any) => s.supplier_tier === 'STANDARD').length || 0,
          restricted: rawStats.recent_suppliers?.filter((s: any) => s.supplier_tier === 'RESTRICTED').length || 0,
        },
        
        // Create payment terms distribution
        payment_terms_distribution: rawStats.recent_suppliers?.reduce((acc: any, supplier: any) => {
          const terms = supplier.payment_terms || 'NET30';
          acc[terms] = (acc[terms] || 0) + 1;
          return acc;
        }, {}) || {},
        
        // Generate mock monthly data based on created dates
        monthly_new_suppliers: rawStats.recent_suppliers?.reduce((acc: any, supplier: any) => {
          const month = supplier.created_at ? supplier.created_at.substring(0, 7) : '2025-07'; // YYYY-MM format
          const existingMonth = acc.find((m: any) => m.month === month);
          if (existingMonth) {
            existingMonth.count += 1;
          } else {
            acc.push({ month, count: 1 });
          }
          return acc;
        }, []) || [],
        
        // Transform top suppliers data
        top_suppliers_by_spend: (rawStats.top_suppliers_by_value || rawStats.recent_suppliers?.slice(0, 5) || []).map((supplier: any) => ({
          supplier: {
            ...supplier,
            total_spend: parseFloat(supplier.total_spend || '0'),
            total_orders: supplier.total_orders || 0,
            quality_rating: parseFloat(supplier.quality_rating || '4.0'),
            performance_score: supplier.performance_score || 75,
            average_delivery_days: supplier.average_delivery_days || 7,
            last_order_date: supplier.last_order_date || null
          },
          total_spend: parseFloat(supplier.total_spend || '0')
        })),
        
        // Calculate totals
        total_spend: rawStats.recent_suppliers?.reduce((sum: number, s: any) => sum + parseFloat(s.total_spend || '0'), 0) || 0,
        average_quality_rating: rawStats.recent_suppliers?.length > 0 
          ? rawStats.recent_suppliers.reduce((sum: number, s: any) => sum + parseFloat(s.quality_rating || '4.0'), 0) / rawStats.recent_suppliers.length
          : 4.0
      };
      
      return analytics;
    } catch (error) {
      console.warn('Supplier Analytics API failed:', error);
      throw error;
    }
  },

  // Get supplier purchase history
  getPurchaseHistory: async (
    supplierId: string, 
    skip: number = 0, 
    limit: number = 10
  ): Promise<{
    supplier: SupplierResponse;
    transactions: Array<{
      id: string;
      transaction_number: string;
      transaction_date: string;
      status: string;
      payment_status: string;
      subtotal: number;
      discount_amount: number;
      tax_amount: number;
      total_amount: number;
      paid_amount: number;
      notes: string;
      created_at: string;
    }>;
    pagination: {
      total: number;
      skip: number;
      limit: number;
      has_next: boolean;
      has_prev: boolean;
    };
    summary: {
      total_transactions: number;
      total_spend: number;
      average_order_value: number;
      last_order_date: string | null;
    };
  }> => {
    try {
      const response = await apiClient.get(`/analytics/analytics/suppliers/${supplierId}/purchases`, {
        params: { skip, limit }
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn('Failed to load supplier purchase history:', error);
      throw error;
    }
  },

  // Get supplier performance history
  getPerformanceHistory: async (supplierId: string): Promise<SupplierPerformanceHistory> => {
    try {
      const response = await apiClient.get(`/analytics/analytics/suppliers/${supplierId}/performance`);
      // The axios interceptor wraps the response in { success: true, data: actualData }
      const data = response.data.success ? response.data.data : response.data;
      
      // Ensure the response has the expected structure
      return {
        supplier: data.supplier,
        performance_metrics: {
          total_orders: data.performance_metrics?.total_orders || 0,
          total_spend: data.performance_metrics?.total_spend || 0,
          average_delivery_days: data.performance_metrics?.average_delivery_days || 0,
          quality_rating: data.performance_metrics?.quality_rating || 0,
          performance_score: data.performance_metrics?.performance_score || 0,
          last_order_date: data.performance_metrics?.last_order_date || null,
        },
        trends: {
          delivery_trend: data.trends?.delivery_trend || 'stable',
          quality_trend: data.trends?.quality_trend || 'stable',
          spend_trend: data.trends?.spend_trend || 'stable',
        },
        recommendations: data.recommendations || []
      };
    } catch (error) {
      console.warn('Failed to load supplier performance history, using fallback:', error);
      // Fallback - return supplier with empty performance history
      const supplier = await suppliersApi.getById(supplierId);
      return {
        supplier,
        performance_metrics: {
          total_orders: supplier.total_orders || 0,
          total_spend: supplier.total_spend || 0,
          average_delivery_days: supplier.average_delivery_days || 7,
          quality_rating: supplier.quality_rating || 4.0,
          performance_score: supplier.performance_score || 75,
          last_order_date: supplier.last_order_date || null
        },
        trends: {
          delivery_trend: 'stable',
          quality_trend: 'stable',
          spend_trend: 'stable'
        },
        recommendations: []
      };
    }
  }
};