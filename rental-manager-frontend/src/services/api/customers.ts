import { apiClient } from '@/lib/axios';

// Customer Types - Updated to match server payload
export interface CustomerCreate {
  customer_code: string;
  customer_type: 'INDIVIDUAL' | 'BUSINESS';
  business_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  tax_number?: string;
  credit_limit?: number;
  payment_terms?: string;
  notes?: string;
}

export interface CustomerUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  credit_limit?: number;
}

export interface CustomerResponse {
  id: string;
  customer_code: string;
  customer_type: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE';
  business_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_number?: string;
  credit_limit: number;
  payment_terms?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
  blacklist_status: 'CLEAR' | 'BLACKLISTED';
  credit_rating: 'GOOD' | 'FAIR' | 'POOR';
  total_rentals: number;
  total_spent: number;
  last_rental_date: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CustomerListResponse {
  items: CustomerResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface CustomerBlacklistRequest {
  action: 'blacklist' | 'unblacklist';
}

export interface CustomerCreditLimitUpdate {
  credit_limit: number;
}

export interface CustomerTierUpdate {
  customer_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

export interface CustomerAnalytics {
  total_customers: number;
  active_customers: number;
  blacklisted_customers: number;
  tier_distribution: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  monthly_new_customers: Array<{
    month: string;
    count: number;
  }>;
  top_customers_by_value: Array<{
    customer: CustomerResponse;
    lifetime_value: number;
  }>;
  customer_types: {
    individual: number;
    business: number;
  };
}

export interface CustomerTransaction {
  id: string;
  transaction_type: 'SALE' | 'RENTAL';
  transaction_status: string;
  transaction_date: string;
  total_amount: number;
  payment_status: string;
  items_count: number;
  location_name?: string;
}

export interface CustomerTransactionHistory {
  customer: CustomerResponse;
  transactions: CustomerTransaction[];
  summary: {
    total_transactions: number;
    total_spent: number;
    average_transaction: number;
    last_transaction_date: string | null;
    favorite_items: string[];
  };
}

export const customersApi = {
  // Create a new customer
  create: async (data: CustomerCreate): Promise<CustomerResponse> => {
    const response = await apiClient.post('/customers/', data);
    return (response.data.success ? response.data.data : response.data) as CustomerResponse;
  },

  // Get all customers with optional filters
  list: async (params?: {
    page?: number;
    page_size?: number;
    skip?: number;
    limit?: number;
    search?: string;
    customer_type?: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE';
    customer_tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    blacklist_status?: 'CLEAR' | 'BLACKLISTED';
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
    is_active?: boolean;
  }): Promise<CustomerListResponse> => {
    const response = await apiClient.get('/customers/', { params });
    
    // The backend returns a raw array of customers, not a paginated response
    // We need to transform it to match the expected CustomerListResponse format
    const customers = response.data.success ? response.data.data : response.data;
    
    // If it's already a CustomerListResponse object, return it as is
    if (customers && typeof customers === 'object' && 'items' in customers) {
      return customers;
    }
    
    // If it's a raw array, wrap it in the expected format
    if (Array.isArray(customers)) {
      return {
        items: customers,
        total: customers.length,
        page: Math.floor((params?.skip || 0) / (params?.limit || 100)) + 1,
        page_size: params?.limit || 100,
        total_pages: Math.ceil(customers.length / (params?.limit || 100)),
        has_next: false, // We don't have pagination info from backend
        has_previous: (params?.skip || 0) > 0
      };
    }
    
    // Fallback to empty response
    return {
      items: [],
      total: 0,
      page: 1,
      page_size: params?.limit || 100,
      total_pages: 0,
      has_next: false,
      has_previous: false
    };
  },

  // Get customer by ID
  getById: async (id: string): Promise<CustomerResponse> => {
    const response = await apiClient.get(`/customers/${id}`);
    return (response.data.success ? response.data.data : response.data) as CustomerResponse;
  },

  // Get customer by code
  getByCode: async (code: string): Promise<CustomerResponse> => {
    const response = await apiClient.get(`/customers/code/${code}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Update customer
  update: async (id: string, data: CustomerUpdate): Promise<CustomerResponse> => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Manage blacklist status
  manageBlacklist: async (id: string, action: 'blacklist' | 'unblacklist'): Promise<CustomerResponse> => {
    const response = await apiClient.post(`/customers/${id}/blacklist`, { action });
    return response.data.success ? response.data.data : response.data;
  },

  // Update credit limit
  updateCreditLimit: async (id: string, credit_limit: number): Promise<CustomerResponse> => {
    const response = await apiClient.put(`/customers/${id}/credit-limit`, { credit_limit });
    return response.data.success ? response.data.data : response.data;
  },

  // Update customer tier
  updateTier: async (id: string, customer_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'): Promise<CustomerResponse> => {
    const response = await apiClient.put(`/customers/${id}/tier`, { customer_tier });
    return response.data.success ? response.data.data : response.data;
  },

  // Delete customer (soft delete)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },

  // Search customers by name
  searchByName: async (name: string, limit: number = 10): Promise<CustomerResponse[]> => {
    const response = await apiClient.get('/customers/search/name', { 
      params: { name, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get blacklisted customers
  getBlacklisted: async (skip: number = 0, limit: number = 100): Promise<CustomerListResponse> => {
    const response = await apiClient.get('/customers/blacklisted/', { 
      params: { skip, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get customers by tier
  getByTier: async (
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM', 
    skip: number = 0, 
    limit: number = 100
  ): Promise<CustomerListResponse> => {
    const response = await apiClient.get(`/customers/tier/${tier}`, { 
      params: { skip, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get customer analytics (will be implemented when backend provides this)
  getAnalytics: async (): Promise<CustomerAnalytics> => {
    try {
      const response = await apiClient.get('/analytics/analytics/customers');
      // The axios interceptor wraps the response in { success: true, data: actualData }
      const analytics = response.data.success ? response.data.data : response.data;
      console.log('Analytics API response:', analytics);
      return analytics;
    } catch (error) {
      console.warn('Analytics API failed, using fallback:', error);
      // Fallback - calculate from customer list for now
      const customers = await customersApi.list({ limit: 1000 });
      
      const items = customers.items || [];
      const analytics: CustomerAnalytics = {
        total_customers: customers.total || 0,
        active_customers: items.filter(c => c?.is_active).length,
        blacklisted_customers: items.filter(c => c?.blacklist_status === 'BLACKLISTED').length,
        tier_distribution: {
          bronze: items.filter(c => c?.customer_tier === 'BRONZE').length,
          silver: items.filter(c => c?.customer_tier === 'SILVER').length,
          gold: items.filter(c => c?.customer_tier === 'GOLD').length,
          platinum: items.filter(c => c?.customer_tier === 'PLATINUM').length,
        },
        monthly_new_customers: [], // Would need date grouping
        top_customers_by_value: items
          .filter(customer => customer?.lifetime_value != null)
          .sort((a, b) => (b.lifetime_value || 0) - (a.lifetime_value || 0))
          .slice(0, 10)
          .map(customer => ({
            customer,
            lifetime_value: customer.lifetime_value || 0
          })),
        customer_types: {
          individual: items.filter(c => c?.customer_type === 'INDIVIDUAL').length,
          business: items.filter(c => c?.customer_type === 'BUSINESS').length,
        }
      };
      
      return analytics;
    }
  },

  // Get customer transaction history (will integrate with transaction API)
  getTransactionHistory: async (customerId: string): Promise<CustomerTransactionHistory> => {
    try {
      const response = await apiClient.get(`/analytics/analytics/customers/${customerId}/transactions`);
      // The axios interceptor wraps the response in { success: true, data: actualData }
      const data = response.data.success ? response.data.data : response.data;
      
      // Ensure the response has the expected structure
      return {
        customer: data.customer,
        transactions: data.transactions || [],
        summary: {
          total_transactions: data.summary?.total_transactions || 0,
          total_spent: data.summary?.total_spent || 0,
          average_transaction: data.summary?.average_transaction || 0,
          last_transaction_date: data.summary?.last_transaction_date || null,
          favorite_items: data.summary?.favorite_items || []
        }
      };
    } catch (error) {
      console.warn('Failed to load transaction history, using fallback:', error);
      // Fallback - return customer with empty transaction history
      const customer = await customersApi.getById(customerId);
      return {
        customer,
        transactions: [],
        summary: {
          total_transactions: 0,
          total_spent: 0,
          average_transaction: 0,
          last_transaction_date: customer.last_transaction_date,
          favorite_items: []
        }
      };
    }
  }
};