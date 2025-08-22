import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/services/api/customers';

export interface UseBusinessCustomersOptions {
  search?: string;
  includeInactive?: boolean;
  limit?: number;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useBusinessCustomers(options: UseBusinessCustomersOptions = {}) {
  const {
    search = '',
    includeInactive = false,
    limit = 100,
    enabled = true,
    cacheTime = 2 * 60 * 1000,      // 2 minutes
    staleTime = 10 * 60 * 1000,     // 10 minutes
  } = options;

  return useQuery({
    queryKey: ['business-customers', { search, includeInactive, limit }],
    queryFn: async () => {
      // Fetch business customers specifically
      const response = await customersApi.list({
        customer_type: 'BUSINESS',
        search,
        limit,
        skip: 0,
      });
      
      // Transform to match supplier interface for dropdown compatibility
      return {
        suppliers: response.items.map(customer => ({
          id: customer.id,
          name: customer.display_name || customer.business_name || 'Unknown Business',
          code: customer.customer_code,
          status: customer.is_active ? 'active' : 'inactive',
          // Additional fields if needed
          company_name: customer.business_name,
          customer_type: customer.customer_type,
          tax_id: customer.tax_id,
        })),
        total: response.total,
      };
    },
    enabled,
    gcTime: cacheTime,
    staleTime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}